import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { Payment } from '../../domain/entities/payment.entity'
import { PaymentStatus } from '../../domain/enums/order.enums'
import {
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentAlreadyFailedError,
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
    @Inject(CLOCK) private readonly clock: Clock
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
    const existing = await this.payments.findByIdempotencyKey(key)

    if (existing) {
      existing.ensureMatchesInitiate(order.id, amount)

      if (existing.status === PaymentStatus.Failed) {
        throw new PaymentAlreadyFailedError()
      }

      return toPaymentView(existing)
    }

    const session = await this.gateway.createPayment({
      amount,
      merchantOrderId: key,
      description: `Order ${order.number}`,
    })

    const payment = Payment.initiate({
      orderId: order.id,
      idempotencyKey: key,
      amount,
      gatewayRef: session.gatewayRef,
      redirectUrl: session.redirectUrl,
      now: this.clock.now(),
    })

    const saved = await this.payments.save(payment)
    return toPaymentView(saved)
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
  }
}
