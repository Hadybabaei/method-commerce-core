import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Payment } from '../../domain/entities/payment.entity'
import { Order } from '../../domain/entities/order.aggregate'
import { OrderStatus, PaymentStatus } from '../../domain/enums/order.enums'
import {
  InsufficientStockForOrderError,
  InventoryLevelMissingError,
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/payment.repository'
import { inquiryGatewayRefs } from '../../domain/payment-inquiry'
import { HandlePaymentCallbackCommand, OrderView } from '../dto/views'
import {
  ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../ports/order-payment-timeout.port'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { PAYMENT_GATEWAY, PaymentGateway } from '../ports/payment-gateway.port'
import { toPaymentView } from './initiate-payment.use-case'
import { OrderNotificationService } from '../order-notification.service'

/**
 * `refund-required` means the money is captured but the order could not be
 * fulfilled — operators must refund or restock.
 */
export type PaymentCallbackState = 'paid' | 'failed' | 'refund-required'

export interface PaymentCallbackResult {
  state: PaymentCallbackState
  payment: ReturnType<typeof toPaymentView>
  order: OrderView
}

const FULFILLMENT_TX_TIMEOUT_MS = 20_000

type Tx = unknown

type FulfillOutcome = {
  /** `captured` = paid by this call, `settled` = already paid before this call. */
  state: 'captured' | 'settled' | 'refund-required'
  payment: Payment
}

/**
 * Completes (or fails) an online payment after the provider redirects back.
 *
 * The callback query string is unauthenticated, so `success=0` is ignored and
 * paid vs failed is decided only by `PaymentGateway.verifyPayment`.
 *
 * A verified capture is committed as SUCCEEDED before any local fulfillment is
 * attempted, and verification happens outside the fulfillment transaction. A
 * rollback (sold-out stock, lock timeout) can therefore never lose money the
 * gateway already took: the payment row keeps the capture and is flagged for
 * refund, and a later callback retries fulfillment.
 */
@Injectable()
export class HandlePaymentCallbackUseCase implements UseCase<
  HandlePaymentCallbackCommand,
  PaymentCallbackResult
> {
  private readonly logger = new Logger(HandlePaymentCallbackUseCase.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly prisma: PrismaService,
    private readonly orderNotifications: OrderNotificationService
  ) {}

  async execute(command: HandlePaymentCallbackCommand): Promise<PaymentCallbackResult> {
    const parsed = this.gateway.parseCallback(command.raw)
    const payment = await this.payments.findByGatewayRef(parsed.gatewayRef)

    if (!payment) {
      throw new PaymentNotFoundError(parsed.gatewayRef)
    }

    // Already captured: never verify again, just retry fulfillment. This is how
    // a refund-flagged order recovers if stock becomes available later.
    if (payment.status === PaymentStatus.Succeeded) {
      return this.settle(payment)
    }

    const verified = await this.gateway.verifyPayment({
      gatewayRef: parsed.gatewayRef,
      expectedAmount: payment.amount,
    })

    if (!verified.ok) {
      // A Failed retry may have issued a newer trackId. A stale fail callback
      // for the old tab must not burn the live session.
      if (
        payment.status === PaymentStatus.Initiated &&
        payment.gatewayRef !== parsed.gatewayRef
      ) {
        return this.view('failed', payment)
      }
      return this.recordFailure(payment, verified.failureReason ?? 'Gateway verification failed')
    }

    return this.settle(await this.recordCapture(payment))
  }

  /**
   * Worker entry: retry fulfillment for a capture, or verify the current
   * (then at most one historical) trackId for INITIATED/FAILED rows the
   * customer never redirected back from.
   */
  async inquire(payment: Payment): Promise<PaymentCallbackResult | null> {
    if (payment.requiresRefund) {
      return null
    }

    if (payment.status === PaymentStatus.Succeeded) {
      return this.settle(payment)
    }

    if (
      payment.status !== PaymentStatus.Initiated &&
      payment.status !== PaymentStatus.Failed
    ) {
      return null
    }

    for (const gatewayRef of inquiryGatewayRefs(payment)) {
      const verified = await this.gateway.verifyPayment({
        gatewayRef,
        expectedAmount: payment.amount,
      })
      if (verified.ok) {
        return this.settle(await this.recordCapture(payment))
      }
      // One unpaid verify is enough for this tick — do not walk every old trackId.
      break
    }

    return null
  }

  /** Commits the capture on its own so fulfillment can never roll it back. */
  private async recordCapture(payment: Payment): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.payments.findByIdForUpdate(payment.id, tx)
      if (!locked) {
        throw new PaymentNotFoundError(payment.id)
      }

      if (locked.status === PaymentStatus.Succeeded) {
        return locked
      }

      locked.markSucceeded(this.clock.now())
      return this.payments.save(locked, tx)
    })
  }

  private async recordFailure(payment: Payment, reason: string): Promise<PaymentCallbackResult> {
    const saved = await this.prisma.$transaction(async (tx) => {
      const locked = await this.payments.findByIdForUpdate(payment.id, tx)
      if (!locked) {
        throw new PaymentNotFoundError(payment.id)
      }

      if (locked.status === PaymentStatus.Succeeded) {
        return locked
      }

      locked.markFailed(reason, this.clock.now())
      return this.payments.save(locked, tx)
    })

    if (saved.status === PaymentStatus.Succeeded) {
      return this.settle(saved)
    }

    return this.view('failed', saved)
  }

  private async settle(payment: Payment): Promise<PaymentCallbackResult> {
    const outcome = await this.fulfill(payment)

    if (outcome.state === 'captured') {
      await this.paymentTimeouts.cancelScheduled(payment.orderId)
      const paidOrder = await this.orders.findById(payment.orderId)
      if (paidOrder) {
        await this.orderNotifications.paid(paidOrder)
      }
    }

    return this.view(outcome.state === 'refund-required' ? 'refund-required' : 'paid', outcome.payment)
  }

  private async fulfill(payment: Payment): Promise<FulfillOutcome> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await this.orders.findByIdForUpdate(payment.orderId, tx)
          if (!order) {
            throw new OrderNotFoundError(payment.orderId)
          }

          if (order.status === OrderStatus.Paid || order.status === OrderStatus.Completed) {
            return { state: 'settled' as const, payment: await this.clearRefundFlag(payment, tx) }
          }

          const expectedStatus = order.status
          if (expectedStatus === OrderStatus.Cancelled) {
            await this.reviveCancelled(order, payment, tx)
          }

          const now = this.clock.now()
          const plan = order.stockAllocations
          order.markPaid(now)
          await this.inventory.consume(plan, tx)
          await this.orders.saveIfStatus(order, expectedStatus, tx)

          return { state: 'captured' as const, payment: await this.clearRefundFlag(payment, tx) }
        },
        { timeout: FULFILLMENT_TX_TIMEOUT_MS }
      )
    } catch (error) {
      if (!isUnfulfillable(error)) {
        throw error
      }
      return {
        state: 'refund-required',
        payment: await this.flagRefundRequired(payment, error.message),
      }
    }
  }

  /** Re-reserves stock and reopens an order the unpaid-cancel job closed. */
  private async reviveCancelled(order: Order, payment: Payment, tx: Tx): Promise<void> {
    this.logger.warn(
      `Reviving cancelled order ${order.id} after verified gateway capture ${payment.gatewayRef}`
    )

    const lines = order.items.flatMap((item) =>
      item.variantId == null ? [] : [{ variantId: item.variantId, quantity: item.quantity }]
    )
    const plan = await this.inventory.reserve(lines, tx)
    order.reviveForPayment(plan)
  }

  private async clearRefundFlag(payment: Payment, tx: Tx): Promise<Payment> {
    if (!payment.requiresRefund) {
      return payment
    }

    payment.clearRefundRequirement(this.clock.now())
    return this.payments.save(payment, tx)
  }

  /**
   * The capture stays SUCCEEDED; only the reason records that this order cannot
   * be fulfilled, so operators can refund instead of the charge going silent.
   */
  private async flagRefundRequired(payment: Payment, reason: string): Promise<Payment> {
    this.logger.error(
      `Captured payment ${payment.gatewayRef} for order ${payment.orderId} cannot be fulfilled: ${reason}. Refund required.`
    )

    return this.prisma.$transaction(async (tx) => {
      const locked = await this.payments.findByIdForUpdate(payment.id, tx)
      if (!locked) {
        throw new PaymentNotFoundError(payment.id)
      }

      locked.flagRefundRequired(reason, this.clock.now())
      return this.payments.save(locked, tx)
    })
  }

  private async view(state: PaymentCallbackState, payment: Payment): Promise<PaymentCallbackResult> {
    return {
      state,
      payment: toPaymentView(payment),
      order: await this.requireOrderView(payment.orderId),
    }
  }

  private async requireOrderView(orderId: number): Promise<OrderView> {
    const view = await this.orderReads.findById(orderId)
    if (!view) {
      throw new OrderNotFoundError(orderId)
    }
    return view
  }
}

/** Errors that mean "we hold the money but cannot deliver this order". */
function isUnfulfillable(error: unknown): error is Error {
  return (
    error instanceof InsufficientStockForOrderError ||
    error instanceof InventoryLevelMissingError ||
    error instanceof OrderNotPayableError
  )
}
