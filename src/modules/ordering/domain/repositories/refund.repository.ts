import { Refund } from '../entities/refund.entity'

export interface RefundRepository {
  create(refund: Refund, tx?: unknown): Promise<Refund>
}

export const REFUND_REPOSITORY = Symbol('RefundRepository')
