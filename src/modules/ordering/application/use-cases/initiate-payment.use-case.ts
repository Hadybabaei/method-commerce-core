import { Inject, Injectable } from '@nestjs/common'
import {
  USER_REPOSITORY,
  UserRepository,
} from '@modules/identity/domain/repositories/user.repository'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { isUniqueConstraintError } from '@shared/infrastructure/persistence/prisma/prisma-errors'
import { Payment } from '../../domain/entities/payment.entity'
import {
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentAlreadyInProgressError,
} from '../../domain/errors/ordering.errors'
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository'
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/payment.repository'
import { InitiatePaymentCommand, PaymentView } from '../dto/views'
import { PAYMENT_GATEWAY, PaymentGateway } from '../ports/payment-gateway.port'

@Injectable()
export class InitiatePaymentUseCase implements UseCase<InitiatePaymentCommand, PaymentView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: InitiatePaymentCommand): Promise<PaymentView> {
    const key = command.idempotencyKey.trim()
    if (!key) {
      throw new OrderNotPayableError('Idempotency-Key is required')
    }

    const order = await this.orders.findById(command.orderId)
    if (!order) {
      throw new OrderNotFoundError(command.orderId)
    }

    order.ensureOwnedBy(command.userId)

    if (!order.canInitiatePayment) {
      throw new OrderNotPayableError('Order cannot start an online payment', {
        status: order.status,
        paymentMethod: order.paymentMethod,
        reservationStatus: order.reservationStatus,
      })
    }

    const amount = order.subtotal.amount
    const payment = await this.lockAndDraftPayment(order.id, command.userId, key, amount)

    if (payment.isCaptured || payment.hasOpenGatewaySession) {
      return toPaymentView(payment)
    }

    const user = await this.users.findById(command.userId)
    const session = await this.gateway.createPayment({
      amount,
      merchantOrderId: key,
      description: `Order ${order.number}`,
      mobileNumber: user?.phoneNumber.value,
    })

    const saved = await this.attachGatewayIfAbsent(payment.id, session)
    return toPaymentView(saved)
  }

  /**
   * First writer to attach a session wins. A overlapping retry with the same
   * key returns that session instead of overwriting `gatewayRef`.
   */
  private async attachGatewayIfAbsent(
    paymentId: number,
    session: { gatewayRef: string; redirectUrl: string }
  ): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.payments.findByIdForUpdate(paymentId, tx)
      if (!locked) {
        throw new OrderNotPayableError('Payment draft disappeared before gateway attach', {
          payment: paymentId,
        })
      }

      if (locked.isCaptured || locked.hasOpenGatewaySession) {
        return locked
      }

      locked.attachGateway(session, this.clock.now())
      return this.payments.save(locked, tx)
    })
  }

  private async lockAndDraftPayment(
    orderId: number,
    userId: number,
    key: string,
    amount: number
  ): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.orders.findByIdForUpdate(orderId, tx)
      if (!locked) {
        throw new OrderNotFoundError(orderId)
      }

      locked.ensureOwnedBy(userId)

      if (!locked.canInitiatePayment) {
        throw new OrderNotPayableError('Order cannot start an online payment', {
          status: locked.status,
          paymentMethod: locked.paymentMethod,
          reservationStatus: locked.reservationStatus,
        })
      }

      const inFlight = await this.payments.findInFlightByOrderId(orderId, tx)
      if (inFlight && inFlight.idempotencyKey !== key) {
        throw new PaymentAlreadyInProgressError({
          order: orderId,
          existingKey: inFlight.idempotencyKey,
        })
      }

      if (inFlight && inFlight.idempotencyKey === key) {
        inFlight.ensureMatchesInitiate(orderId, amount)
        return inFlight
      }

      const existing = await this.payments.findByIdempotencyKey(key)
      if (existing) {
        existing.ensureMatchesInitiate(orderId, amount)
        return existing
      }

      const draft = Payment.draft({
        orderId,
        idempotencyKey: key,
        amount,
        now: this.clock.now(),
      })

      try {
        return await this.payments.save(draft, tx)
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
        const raced = await this.payments.findByIdempotencyKey(key)
        if (!raced) {
          throw error
        }
        raced.ensureMatchesInitiate(orderId, amount)
        return raced
      }
    })
  }
}

export function toPaymentView(payment: Payment): PaymentView {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    status: payment.status,
    gatewayRef: payment.gatewayRef,
    redirectUrl: payment.redirectUrl,
    idempotencyKey: payment.idempotencyKey,
    requiresRefund: payment.requiresRefund,
    failureReason: payment.failureReason,
  }
}
