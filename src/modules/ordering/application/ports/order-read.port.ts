import { ListOrdersQuery, OrderView, PaginatedOrdersView } from '../dto/views'

export interface OrderReadModel {
  findById(id: number): Promise<OrderView | null>

  list(
    query: Required<Pick<ListOrdersQuery, 'limit' | 'offset'>> & ListOrdersQuery
  ): Promise<PaginatedOrdersView>
}

export const ORDER_READ_MODEL = Symbol('OrderReadModel')
