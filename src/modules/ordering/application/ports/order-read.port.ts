import {
  ListOrdersQuery,
  OrderView,
  PaginatedOrdersView,
  PaginatedReturnRequestsView,
} from '../dto/views'
import { ReturnRequestStatus } from '../../domain/enums/order.enums'

export interface OrderReadModel {
  findById(id: number): Promise<OrderView | null>

  list(
    query: Required<Pick<ListOrdersQuery, 'limit' | 'offset'>> & ListOrdersQuery
  ): Promise<PaginatedOrdersView>

  /** Admin queue of return requests, oldest first within a status. */
  listReturnRequests(query: {
    status?: ReturnRequestStatus
    limit: number
    offset: number
  }): Promise<PaginatedReturnRequestsView>
}

export const ORDER_READ_MODEL = Symbol('OrderReadModel')
