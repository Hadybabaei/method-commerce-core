import { Payment } from '../entities/payment.entity'

export interface PaymentRepository {
  findById(id: number): Promise<Payment | null>

  findByIdempotencyKey(key: string): Promise<Payment | null>

  findByGatewayRef(gatewayRef: string): Promise<Payment | null>

  save(payment: Payment, tx?: unknown): Promise<Payment>
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository')
