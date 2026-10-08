import { ReturnRequest } from '../entities/return-request.aggregate'

export interface ReturnRequestRepository {
  findById(id: number, tx?: unknown): Promise<ReturnRequest | null>

  /** Every request on the order, oldest first. */
  listByOrder(orderId: number, tx?: unknown): Promise<ReturnRequest[]>

  save(request: ReturnRequest, tx?: unknown): Promise<ReturnRequest>
}

export const RETURN_REQUEST_REPOSITORY = Symbol('ReturnRequestRepository')
