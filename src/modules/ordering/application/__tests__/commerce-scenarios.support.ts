import { Address } from '@modules/addressing/domain/entities/address.aggregate'
import { AddressView } from '@modules/addressing/application/dto/views'
import { AddressReadModel } from '@modules/addressing/application/ports/address-read.port'
import { AddressRepository } from '@modules/addressing/domain/repositories/address.repository'
import { PostalCode } from '@modules/addressing/domain/value-objects/postal-code.vo'
import { Receiver } from '@modules/addressing/domain/value-objects/receiver.vo'
import { BasketLineView, BasketView } from '@modules/basket/application/dto/views'
import { BasketReadModel } from '@modules/basket/application/ports/basket-read.port'
import { Basket } from '@modules/basket/domain/entities/basket.aggregate'
import { BasketItem } from '@modules/basket/domain/entities/basket-item.entity'
import { BasketRepository } from '@modules/basket/domain/repositories/basket.repository'
import { Quantity } from '@modules/basket/domain/value-objects/quantity.vo'
import {
  SellableVariantLookup,
  SellableVariantSnapshot,
} from '@modules/catalog/application/ports/sellable-variant.port'
import { Clock } from '@shared/application/ports/clock.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Order } from '../../domain/entities/order.aggregate'
import { OrderItem } from '../../domain/entities/order-item.entity'
import { Payment } from '../../domain/entities/payment.entity'
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../domain/enums/order.enums'
import {
  InsufficientStockForOrderError,
  InventoryLevelMissingError,
  OrderConflictError,
  OrderNotCancellableError,
  OrderNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  InventoryReservationService,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import { PaymentRepository } from '../../domain/repositories/payment.repository'
import {
  StockAllocation,
  StockAllocationPlan,
} from '../../domain/value-objects/stock-allocation.vo'
import { OrderView } from '../dto/views'
import { OrderReadModel } from '../ports/order-read.port'
import {
  CreateGatewayPaymentInput,
  CreateGatewayPaymentResult,
  ParsedGatewayCallback,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../ports/payment-gateway.port'
import { CancelOrderUseCase } from '../use-cases/cancel-order.use-case'
import { CompleteOrderUseCase } from '../use-cases/complete-order.use-case'
import { ConfirmCodPaymentUseCase } from '../use-cases/confirm-cod-payment.use-case'
import { CreateOrderUseCase } from '../use-cases/create-order.use-case'
import { PreviewCheckoutUseCase } from '../use-cases/preview-checkout.use-case'
import { CheckoutAssembler } from '../services/checkout-assembler.service'
import { OrderNotificationService } from '../order-notification.service'
import {
  Notifications,
  SendNotificationCommand,
} from '@modules/notifications'
import { GetOrderUseCase } from '../use-cases/get-list-orders.use-case'
import { HandlePaymentCallbackUseCase } from '../use-cases/handle-payment-callback.use-case'
import { InitiatePaymentUseCase } from '../use-cases/initiate-payment.use-case'
import { InquireOpenPaymentsUseCase } from '../use-cases/inquire-open-payments.use-case'
import { ConfigService } from '@nestjs/config'
import { OrderPaymentTimeoutScheduler } from '../ports/order-payment-timeout.port'
import { UserRepository } from '@modules/identity/domain/repositories/user.repository'
import { User } from '@modules/identity/domain/entities/user.aggregate'

class AsyncMutex {
  private tail: Promise<void> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn)
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

/** Mutex that can be held across awaits until the fake transaction releases it. */
class HoldMutex {
  private owner: unknown = null
  private depth = 0
  private readonly waiters: Array<() => void> = []

  async acquire(owner: unknown): Promise<void> {
    if (this.owner === owner) {
      this.depth += 1
      return
    }
    if (this.owner === null) {
      this.owner = owner
      this.depth = 1
      return
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve))
    this.owner = owner
    this.depth = 1
  }

  release(): void {
    this.depth -= 1
    if (this.depth > 0) {
      return
    }
    const next = this.waiters.shift()
    if (next) {
      next()
    } else {
      this.owner = null
    }
  }
}

type LockBag = { _releases?: Array<() => void> }

function attachTxRelease(tx: unknown, release: () => void): void {
  if (!tx || typeof tx !== 'object') {
    return
  }
  const bag = tx as LockBag
  if (!bag._releases) {
    bag._releases = []
  }
  bag._releases.push(release)
}

function uniqueConstraintError(field: string): Error {
  const error = new Error(`Unique constraint failed on ${field}`)
  Object.assign(error, { code: 'P2002', meta: { target: [field] } })
  return error
}

export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-09-17T10:00:00.000Z')) {}

  now(): Date {
    return this.current
  }

  secondsFromNow(seconds: number): Date {
    return new Date(this.current.getTime() + seconds * 1000)
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }

  advanceSeconds(seconds: number): void {
    this.advanceMs(seconds * 1000)
  }
}

export type InventoryLevelState = {
  variantId: number
  locationId: number
  onHand: number
  reserved: number
}

export class InMemoryInventory implements InventoryReservationService {
  private readonly levels = new Map<string, InventoryLevelState>()
  private readonly locks = new Map<number, AsyncMutex>()

  seed(variantId: number, locationId: number, onHand: number, reserved = 0): void {
    this.levels.set(`${variantId}:${locationId}`, { variantId, locationId, onHand, reserved })
  }

  snapshot(variantId: number): InventoryLevelState[] {
    return [...this.levels.values()].filter((level) => level.variantId === variantId)
  }

  available(variantId: number): number {
    return this.snapshot(variantId).reduce(
      (sum, level) => sum + Math.max(0, level.onHand - level.reserved),
      0
    )
  }

  async reserve(
    lines: ReadonlyArray<{ variantId: number; quantity: number }>,
    _tx: unknown
  ): Promise<StockAllocationPlan> {
    const allocations: StockAllocation[] = []

    for (const line of lines) {
      await this.lockFor(line.variantId).run(async () => {
        let remaining = line.quantity
        const levels = this.snapshot(line.variantId).sort((a, b) => a.locationId - b.locationId)

        for (const level of levels) {
          if (remaining <= 0) break
          const free = Math.max(0, level.onHand - level.reserved)
          if (free <= 0) continue
          const take = Math.min(free, remaining)
          level.reserved += take
          allocations.push({
            variantId: line.variantId,
            locationId: level.locationId,
            quantity: take,
          })
          remaining -= take
        }

        if (remaining > 0) {
          throw new InsufficientStockForOrderError(
            line.variantId,
            this.available(line.variantId),
            line.quantity
          )
        }
      })
    }

    return StockAllocationPlan.of(allocations)
  }

  async release(plan: StockAllocationPlan, _tx: unknown): Promise<void> {
    for (const row of plan.allocations) {
      await this.lockFor(row.variantId).run(async () => {
        const level = this.levels.get(`${row.variantId}:${row.locationId}`)
        if (!level) {
          throw new InventoryLevelMissingError(row.variantId, row.locationId)
        }
        level.reserved = Math.max(0, level.reserved - row.quantity)
      })
    }
  }

  async consume(plan: StockAllocationPlan, _tx: unknown): Promise<void> {
    for (const row of plan.allocations) {
      await this.lockFor(row.variantId).run(async () => {
        const level = this.levels.get(`${row.variantId}:${row.locationId}`)
        if (!level) {
          throw new InventoryLevelMissingError(row.variantId, row.locationId)
        }
        level.onHand = Math.max(0, level.onHand - row.quantity)
        level.reserved = Math.max(0, level.reserved - row.quantity)
      })
    }
  }

  private lockFor(variantId: number): AsyncMutex {
    let mutex = this.locks.get(variantId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.locks.set(variantId, mutex)
    }
    return mutex
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  private nextId = 1
  readonly byId = new Map<number, Order>()
  private readonly locks = new Map<number, HoldMutex>()
  private readonly sequenceLock = new HoldMutex()

  async findById(id: number): Promise<Order | null> {
    return this.clone(this.byId.get(id) ?? null)
  }

  async findByNumber(number: string): Promise<Order | null> {
    for (const order of this.byId.values()) {
      if (order.number === number) return this.clone(order)
    }
    return null
  }

  async findByIdForUpdate(id: number, tx: unknown): Promise<Order | null> {
    const mutex = this.lockFor(id)
    await mutex.acquire(tx)
    attachTxRelease(tx, () => mutex.release())
    return this.findById(id)
  }

  async create(order: Order): Promise<Order> {
    for (const existing of this.byId.values()) {
      if (existing.number === order.number) {
        throw uniqueConstraintError('number')
      }
    }
    const id = this.nextId++
    const persisted = this.rehydrate(id, order)
    this.byId.set(id, persisted)
    return this.clone(persisted)!
  }

  async save(order: Order): Promise<Order> {
    const persisted = this.rehydrate(order.id, order)
    this.byId.set(order.id, persisted)
    return this.clone(persisted)!
  }

  async saveIfStatus(order: Order, expectedStatus: OrderStatus): Promise<Order> {
    const current = this.byId.get(order.id)
    if (!current || current.status !== expectedStatus) {
      throw new OrderConflictError({ order: order.id, expectedStatus })
    }
    return this.save(order)
  }

  async nextDailySequence(dayKey: string, tx?: unknown): Promise<number> {
    await this.sequenceLock.acquire(tx ?? this)
    attachTxRelease(tx, () => this.sequenceLock.release())
    if (!tx) {
      this.sequenceLock.release()
    }
    const prefix = `ORD-${dayKey}-`
    let max = 0
    for (const order of this.byId.values()) {
      if (!order.number.startsWith(prefix)) continue
      const parsed = Number.parseInt(order.number.slice(prefix.length), 10)
      if (Number.isFinite(parsed) && parsed > max) max = parsed
    }
    return max + 1
  }

  private lockFor(id: number): HoldMutex {
    let mutex = this.locks.get(id)
    if (!mutex) {
      mutex = new HoldMutex()
      this.locks.set(id, mutex)
    }
    return mutex
  }

  private rehydrate(id: number, order: Order): Order {
    return Order.fromPersistence(id, {
      number: order.number,
      userId: order.userId,
      status: order.status,
      reservationStatus: order.reservationStatus,
      paymentMethod: order.paymentMethod,
      items: order.items.map((item, index) =>
        OrderItem.fromPersistence({
          id: item.id || index + 1,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.amount,
          lineTotal: item.lineTotal.amount,
          productSnapshot: item.productSnapshot,
        })
      ),
      addressSnapshot: order.addressSnapshot,
      note: order.note,
      stockAllocations: order.stockAllocations,
      cancelledAt: order.cancelledAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
    })
  }

  private clone(order: Order | null): Order | null {
    return order ? this.rehydrate(order.id, order) : null
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private nextId = 1
  private readonly byId = new Map<number, Payment>()
  private readonly locks = new Map<number, HoldMutex>()
  private readonly refsByTrack = new Map<string, number>()

  async findById(id: number): Promise<Payment | null> {
    return this.clone(this.byId.get(id) ?? null)
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    for (const payment of this.byId.values()) {
      if (payment.idempotencyKey === key) return this.clone(payment)
    }
    return null
  }

  async findByGatewayRef(gatewayRef: string): Promise<Payment | null> {
    const id = this.refsByTrack.get(gatewayRef)
    if (id !== undefined) {
      return this.findById(id)
    }
    for (const payment of this.byId.values()) {
      if (payment.gatewayRef === gatewayRef) return this.clone(payment)
    }
    return null
  }

  async findInFlightByOrderId(orderId: number): Promise<Payment | null> {
    let latest: Payment | null = null
    for (const payment of this.byId.values()) {
      if (payment.orderId !== orderId) continue
      if (
        payment.status !== PaymentStatus.Initiated &&
        payment.status !== PaymentStatus.Failed &&
        payment.status !== PaymentStatus.Succeeded
      ) {
        continue
      }
      if (!latest || payment.id > latest.id) latest = payment
    }
    return this.clone(latest)
  }

  async findByIdForUpdate(id: number, tx: unknown): Promise<Payment | null> {
    const mutex = this.lockFor(id)
    await mutex.acquire(tx)
    attachTxRelease(tx, () => mutex.release())
    return this.findById(id)
  }

  async listOpenForInquiry(limit = 50): Promise<Payment[]> {
    const captured: Payment[] = []
    const sessions: Payment[] = []
    for (const payment of this.byId.values()) {
      if (payment.requiresRefund) {
        continue
      }
      if (payment.status === PaymentStatus.Succeeded) {
        captured.push(this.clone(payment)!)
        continue
      }
      if (
        (payment.status === PaymentStatus.Initiated || payment.status === PaymentStatus.Failed) &&
        payment.gatewayRef
      ) {
        sessions.push(this.clone(payment)!)
      }
    }
    captured.sort((a, b) => a.id - b.id)
    sessions.sort((a, b) => b.id - a.id)
    return [...captured, ...sessions].slice(0, limit)
  }

  async save(payment: Payment): Promise<Payment> {
    if (payment.isNew) {
      for (const existing of this.byId.values()) {
        if (existing.idempotencyKey === payment.idempotencyKey) {
          throw uniqueConstraintError('idempotencyKey')
        }
      }
    }
    const id = payment.isNew ? this.nextId++ : payment.id
    const persisted = this.persist(id, payment)
    this.byId.set(id, persisted)
    for (const ref of persisted.knownGatewayRefs) {
      this.refsByTrack.set(ref, id)
    }
    return this.clone(persisted)!
  }

  private lockFor(id: number): HoldMutex {
    let mutex = this.locks.get(id)
    if (!mutex) {
      mutex = new HoldMutex()
      this.locks.set(id, mutex)
    }
    return mutex
  }

  private clone(payment: Payment | null): Payment | null {
    return payment ? this.persist(payment.id, payment) : null
  }

  private persist(id: number, payment: Payment): Payment {
    return Payment.fromPersistence(id, {
      orderId: payment.orderId,
      idempotencyKey: payment.idempotencyKey,
      gatewayRef: payment.gatewayRef,
      knownGatewayRefs: [...payment.knownGatewayRefs],
      amount: payment.amount,
      status: payment.status,
      failureReason: payment.failureReason,
      redirectUrl: payment.redirectUrl,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })
  }
}

class InMemoryOrderReads implements OrderReadModel {
  constructor(
    private readonly orders: InMemoryOrderRepository,
    private readonly payments: InMemoryPaymentRepository
  ) {}

  async findById(id: number): Promise<OrderView | null> {
    const order = await this.orders.findById(id)
    if (!order) return null
    const payment = await this.payments.findInFlightByOrderId(order.id)
    const captured = payment?.status === PaymentStatus.Succeeded
    return {
      id: order.id,
      number: order.number,
      userId: order.userId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      itemCount: order.itemCount,
      subtotal: order.subtotal.amount,
      note: order.note,
      address: order.addressSnapshot,
      items: order.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        lineTotal: item.lineTotal.amount,
        product: item.productSnapshot,
      })),
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            requiresRefund: payment.requiresRefund,
            failureReason: payment.failureReason,
            gatewayRef: payment.gatewayRef,
          }
        : null,
      canCancel: order.status === OrderStatus.Pending && !captured,
      cancelledAt: order.cancelledAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
    }
  }

  async list(): Promise<{ items: OrderView[]; total: number; limit: number; offset: number }> {
    return { items: [], total: 0, limit: 20, offset: 0 }
  }
}

class InMemoryBaskets implements BasketRepository, BasketReadModel {
  private nextId = 1
  private readonly byUser = new Map<number, Basket>()
  private readonly issues = new Map<string, BasketLineView['issues']>()
  private readonly locks = new Map<number, HoldMutex>()

  constructor(
    private readonly variants: Map<number, SellableVariantSnapshot>,
    private readonly inventory: InMemoryInventory
  ) {}

  seedBasket(userId: number, lines: Array<{ variantId: number; quantity: number }>): void {
    const items = lines.map((line) => BasketItem.create(line.variantId, Quantity.of(line.quantity)))
    this.byUser.set(userId, Basket.fromPersistence(this.nextId++, userId, items))
  }

  setIssues(userId: number, variantId: number, issues: BasketLineView['issues']): void {
    this.issues.set(`${userId}:${variantId}`, issues)
  }

  async findByUserId(userId: number): Promise<Basket | null> {
    const basket = this.byUser.get(userId)
    return basket ? this.clone(basket) : null
  }

  async lockByUserId(userId: number, tx: unknown): Promise<Basket | null> {
    const mutex = this.lockFor(userId)
    await mutex.acquire(tx)
    attachTxRelease(tx, () => mutex.release())
    return this.findByUserId(userId)
  }

  async save(basket: Basket): Promise<Basket> {
    const id = basket.isNew ? this.nextId++ : basket.id
    const persisted = Basket.fromPersistence(
      id,
      basket.userId,
      basket.getItems().map((item) => BasketItem.fromPersistence(item.variantId, item.quantityValue))
    )
    this.byUser.set(basket.userId, persisted)
    return this.clone(persisted)
  }

  async getByUserId(userId: number): Promise<BasketView | null> {
    const basket = this.byUser.get(userId)
    if (!basket) return null

    const items: BasketLineView[] = basket.getItems().map((item) => {
      const sellable = this.variants.get(item.variantId)
      const unitPrice = sellable?.unitPrice ?? 0
      return {
        variantId: item.variantId,
        quantity: item.quantityValue,
        unitPrice,
        lineTotal: unitPrice * item.quantityValue,
        availableQuantity: this.inventory.available(item.variantId),
        product: {
          id: sellable?.productId ?? 0,
          title: sellable?.productTitle ?? 'Unknown',
          slug: sellable?.productSlug ?? 'unknown',
          thumbnail: null,
        },
        variant: {
          sku: sellable?.sku ?? '',
          options: sellable?.options ?? [],
          image: null,
          isActive: sellable?.isActive ?? true,
        },
        issues: this.issues.get(`${userId}:${item.variantId}`) ?? [],
      }
    })

    return {
      id: basket.id,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: items.reduce((sum, line) => sum + line.lineTotal, 0),
      items,
    }
  }

  private clone(basket: Basket): Basket {
    return Basket.fromPersistence(
      basket.id,
      basket.userId,
      basket.getItems().map((item) => BasketItem.fromPersistence(item.variantId, item.quantityValue))
    )
  }

  private lockFor(userId: number): HoldMutex {
    let mutex = this.locks.get(userId)
    if (!mutex) {
      mutex = new HoldMutex()
      this.locks.set(userId, mutex)
    }
    return mutex
  }
}

class InMemoryAddresses implements AddressRepository {
  readonly byId = new Map<number, Address>()
  readonly views = new Map<number, AddressView>()

  seed(address: Address, view: AddressView): void {
    this.byId.set(address.id, address)
    this.views.set(address.id, view)
  }

  async findById(id: number): Promise<Address | null> {
    return this.byId.get(id) ?? null
  }

  async findAllByUserId(): Promise<Address[]> {
    return []
  }

  async countByUserId(): Promise<number> {
    return 0
  }

  async save(address: Address): Promise<Address> {
    this.byId.set(address.id, address)
    return address
  }

  async delete(id: number): Promise<void> {
    this.byId.delete(id)
  }
}

function asAddressReads(store: InMemoryAddresses): AddressReadModel {
  return {
    findById: async (id) => store.views.get(id) ?? null,
    listByUserId: async () => [],
  }
}

class InMemoryVariants implements SellableVariantLookup {
  constructor(
    private readonly variants: Map<number, SellableVariantSnapshot>,
    private readonly inventory: InMemoryInventory
  ) {}

  async findById(variantId: number): Promise<SellableVariantSnapshot | null> {
    const base = this.variants.get(variantId)
    if (!base) return null
    return { ...base, availableQuantity: this.inventory.available(variantId) }
  }
}

/** In-memory PaymentGateway double — mimics Zibal trackId/redirect/verify. */
export class FakePaymentGateway implements PaymentGateway {
  readonly provider = 'fake'
  private nextTrack = 1000
  private readonly verified = new Set<string>()
  /** Force the next verify to fail (for negative tests). */
  failNextVerify = false
  /** Amount overrides keyed by trackId for mismatch tests. */
  paidAmountByRef = new Map<string, number>()
  /** When set, createPayment waits so overlapping same-key retries can race. */
  createGate: Promise<void> | null = null
  createWaiters = 0
  /** When set, verifyPayment waits so overlapping inquiry ticks can race. */
  verifyGate: Promise<void> | null = null
  verifyWaiters = 0
  /** TrackIds passed to verifyPayment, in call order. */
  readonly verifyCalls: string[] = []

  async createPayment(input: CreateGatewayPaymentInput): Promise<CreateGatewayPaymentResult> {
    this.createWaiters += 1
    if (this.createGate) {
      await this.createGate
    }
    const gatewayRef = String(this.nextTrack++)
    return {
      gatewayRef,
      redirectUrl: `https://gateway.test/start/${gatewayRef}?order=${input.merchantOrderId}`,
    }
  }

  async verifyPayment(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    this.verifyCalls.push(input.gatewayRef)
    this.verifyWaiters += 1
    if (this.verifyGate) {
      await this.verifyGate
    }
    if (this.failNextVerify) {
      this.failNextVerify = false
      return { ok: false, failureReason: 'declined' }
    }

    if (this.verified.has(input.gatewayRef)) {
      return { ok: true, alreadyVerified: true, paidAmount: input.expectedAmount }
    }

    const paidAmount = this.paidAmountByRef.get(input.gatewayRef) ?? input.expectedAmount
    this.verified.add(input.gatewayRef)
    return { ok: true, refNumber: `REF-${input.gatewayRef}`, paidAmount }
  }

  parseCallback(raw: Record<string, string | undefined>): ParsedGatewayCallback {
    const gatewayRef = raw.trackId?.trim()
    if (!gatewayRef) {
      throw new Error('missing trackId')
    }
    const successFlag = raw.success === '1'
    const status = raw.status !== undefined ? Number(raw.status) : NaN
    const reportedSuccess = successFlag && (Number.isNaN(status) || status === 2)
    return { gatewayRef, reportedSuccess }
  }
}

function fakePrisma(): PrismaService {
  return {
    $transaction: async <T>(
      fn: (tx: unknown) => Promise<T>,
      _options?: unknown
    ): Promise<T> => {
      const tx: LockBag = { _releases: [] }
      try {
        return await fn(tx)
      } finally {
        const releases = tx._releases ?? []
        while (releases.length > 0) {
          releases.pop()?.()
        }
      }
    },
  } as unknown as PrismaService
}

class InMemoryUsers implements UserRepository {
  async findById(): Promise<User | null> {
    return null
  }

  async findByPhoneNumber(): Promise<User | null> {
    return null
  }

  async save(user: User): Promise<User> {
    return user
  }

  async existsByPhoneNumber(): Promise<boolean> {
    return false
  }
}

export const defaultAddressView = (id = 1): AddressView => ({
  id,
  title: 'خانه',
  province: { id: 1, name: 'تهران', slug: 'tehran', telPrefix: '021' },
  city: { id: 1, name: 'تهران', slug: 'tehran', provinceId: 1 },
  hood: 'نیاوران',
  postalCode: '1234567890',
  pelak: '12',
  vahed: '3',
  details: 'پلاک ۱۲',
  receiver: { isAccountOwner: true, fullName: null, phoneNumber: null },
  location: null,
})

export function seedAddress(userId: number, id = 1): { address: Address; view: AddressView } {
  const view = defaultAddressView(id)
  const address = Address.fromPersistence(id, {
    userId,
    title: view.title,
    provinceId: view.province.id,
    cityId: view.city.id,
    hood: view.hood,
    postalCode: PostalCode.fromPersistence(view.postalCode),
    pelak: view.pelak,
    vahed: view.vahed,
    details: view.details,
    receiver: Receiver.accountOwner(),
    location: null,
  })
  return { address, view }
}

export function defaultVariant(
  variantId: number,
  overrides: Partial<SellableVariantSnapshot> = {}
): SellableVariantSnapshot {
  return {
    variantId,
    productId: 10,
    productTitle: 'Drill',
    productSlug: 'drill',
    productPublished: true,
    sku: `SKU-${variantId}`,
    isActive: true,
    unitPrice: 1_000_000,
    compareAtPrice: null,
    availableQuantity: 10,
    options: [{ option: 'رنگ', value: 'قرمز' }],
    image: null,
    thumbnail: null,
    ...overrides,
  }
}

export class RecordingNotifications implements Notifications {
  readonly sent: SendNotificationCommand[] = []

  async sendNotification(command: SendNotificationCommand): Promise<void> {
    this.sent.push(command)
  }
}

export interface CommerceHarness {
  clock: FakeClock
  inventory: InMemoryInventory
  orders: InMemoryOrderRepository
  payments: InMemoryPaymentRepository
  baskets: InMemoryBaskets
  variants: Map<number, SellableVariantSnapshot>
  variantLookup: InMemoryVariants
  gateway: FakePaymentGateway
  createOrder: CreateOrderUseCase
  previewCheckout: PreviewCheckoutUseCase
  cancelOrder: CancelOrderUseCase
  confirmCod: ConfirmCodPaymentUseCase
  completeOrder: CompleteOrderUseCase
  getOrder: GetOrderUseCase
  initiatePayment: InitiatePaymentUseCase
  handleCallback: HandlePaymentCallbackUseCase
  inquirePayments: InquireOpenPaymentsUseCase
  notifications: RecordingNotifications
  paymentTimeouts: InMemoryOrderPaymentTimeoutScheduler
  /** Drain BullMQ-equivalent jobs whose delay has elapsed on the fake clock. */
  runDueUnpaidCancels: () => Promise<void>
  seedStock: (variantId: number, onHand: number, locationId?: number) => void
  seedCatalogVariant: (variant: SellableVariantSnapshot) => void
  seedUserBasket: (
    userId: number,
    lines: Array<{ variantId: number; quantity: number }>
  ) => void
  seedUserAddress: (userId: number, addressId?: number) => number
  /** Helper: Zibal-shaped success callback for a trackId. */
  successCallbackRaw: (trackId: string) => Record<string, string>
  failCallbackRaw: (trackId: string) => Record<string, string>
}

/** Tests use 10s so the unpaid-cancel path is asserted without a 15-minute wait. */
export const TEST_UNPAID_CANCEL_DELAY_MS = 10_000

type ScheduledUnpaidCancel = {
  orderId: number
  delayMs: number
  dueAtMs: number
}

/**
 * In-process stand-in for the BullMQ delayed job. Tests advance the fake clock
 * then drain due jobs the same way the worker would.
 */
export class InMemoryOrderPaymentTimeoutScheduler implements OrderPaymentTimeoutScheduler {
  readonly jobs = new Map<number, ScheduledUnpaidCancel>()
  failNextSchedule = false
  isOperational = true

  constructor(private readonly nowMs: () => number) {}

  async scheduleCancelIfUnpaid(orderId: number, delayMs: number): Promise<void> {
    if (this.failNextSchedule) {
      this.failNextSchedule = false
      throw new Error('queue unavailable')
    }
    this.jobs.set(orderId, {
      orderId,
      delayMs,
      dueAtMs: this.nowMs() + delayMs,
    })
  }

  async cancelScheduled(orderId: number): Promise<void> {
    this.jobs.delete(orderId)
  }

  dueJobs(nowMs = this.nowMs()): ScheduledUnpaidCancel[] {
    return [...this.jobs.values()].filter((job) => job.dueAtMs <= nowMs)
  }
}

function orderingConfigService(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'orderingJobs') {
        return { unpaidCancelDelayMs: TEST_UNPAID_CANCEL_DELAY_MS }
      }
      throw new Error(`Unexpected config: ${key}`)
    },
  } as ConfigService
}

export function createCommerceHarness(): CommerceHarness {
  const clock = new FakeClock()
  const inventory = new InMemoryInventory()
  const variants = new Map<number, SellableVariantSnapshot>()
  const variantLookup = new InMemoryVariants(variants, inventory)
  const baskets = new InMemoryBaskets(variants, inventory)
  const addresses = new InMemoryAddresses()
  const orders = new InMemoryOrderRepository()
  const payments = new InMemoryPaymentRepository()
  const orderReads = new InMemoryOrderReads(orders, payments)
  const prisma = fakePrisma()
  const gateway = new FakePaymentGateway()
  const paymentTimeouts = new InMemoryOrderPaymentTimeoutScheduler(() => clock.now().getTime())
  const orderingConfig = orderingConfigService()
  const notifications = new RecordingNotifications()
  const orderNotifications = new OrderNotificationService(notifications)
  const assembler = new CheckoutAssembler(addresses, asAddressReads(addresses), variantLookup)
  const users = new InMemoryUsers()
  const cancelOrder = new CancelOrderUseCase(
    orders,
    orderReads,
    inventory,
    payments,
    paymentTimeouts,
    orderNotifications,
    prisma
  )
  const handleCallback = new HandlePaymentCallbackUseCase(
    orders,
    payments,
    orderReads,
    inventory,
    gateway,
    paymentTimeouts,
    clock,
    prisma,
    orderNotifications
  )

  return {
    clock,
    inventory,
    orders,
    payments,
    baskets,
    variants,
    variantLookup,
    gateway,
    createOrder: new CreateOrderUseCase(
      baskets,
      baskets,
      assembler,
      orders,
      orderReads,
      inventory,
      paymentTimeouts,
      cancelOrder,
      orderNotifications,
      prisma,
      orderingConfig
    ),
    previewCheckout: new PreviewCheckoutUseCase(baskets, assembler),
    cancelOrder,
    confirmCod: new ConfirmCodPaymentUseCase(
      orders,
      orderReads,
      inventory,
      clock,
      orderNotifications,
      prisma
    ),
    completeOrder: new CompleteOrderUseCase(orders, orderReads, clock, orderNotifications, prisma),
    getOrder: new GetOrderUseCase(orderReads),
    initiatePayment: new InitiatePaymentUseCase(orders, payments, gateway, users, clock, prisma),
    handleCallback,
    inquirePayments: new InquireOpenPaymentsUseCase(payments, orders, clock, handleCallback),
    notifications,
    paymentTimeouts,
    runDueUnpaidCancels: async () => {
      for (const job of paymentTimeouts.dueJobs()) {
        await paymentTimeouts.cancelScheduled(job.orderId)
        const order = await orders.findById(job.orderId)
        if (!order || order.paymentMethod !== PaymentMethod.Online || !order.canCancel) {
          continue
        }
        const captured = await payments.findInFlightByOrderId(job.orderId)
        if (captured?.status === PaymentStatus.Succeeded) {
          continue
        }
        try {
          await cancelOrder.execute({ orderId: job.orderId })
        } catch (error) {
          if (error instanceof OrderNotCancellableError || error instanceof OrderNotFoundError) {
            continue
          }
          throw error
        }
      }
    },
    seedStock: (variantId, onHand, locationId = 1) => {
      inventory.seed(variantId, locationId, onHand)
    },
    seedCatalogVariant: (variant) => {
      variants.set(variant.variantId, variant)
    },
    seedUserBasket: (userId, lines) => baskets.seedBasket(userId, lines),
    seedUserAddress: (userId, addressId = 1) => {
      const { address, view } = seedAddress(userId, addressId)
      addresses.seed(address, view)
      return addressId
    },
    successCallbackRaw: (trackId) => ({
      trackId,
      success: '1',
      status: '2',
    }),
    failCallbackRaw: (trackId) => ({
      trackId,
      success: '0',
      status: '3',
    }),
  }
}

export { OrderStatus, PaymentMethod }
