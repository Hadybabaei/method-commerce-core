import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { InvalidInputError } from '@shared/domain/errors'
import { OrderNotFoundError, OrderNotOwnedError } from '../../domain/errors/ordering.errors'
import { ListOrdersQuery, OrderView, PaginatedOrdersView } from '../dto/views'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

@Injectable()
export class GetOrderUseCase implements UseCase<{ orderId: number; userId?: number }, OrderView> {
  constructor(@Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel) {}

  async execute(input: { orderId: number; userId?: number }): Promise<OrderView> {
    const view = await this.orderReads.findById(input.orderId)
    if (!view) {
      throw new OrderNotFoundError(input.orderId)
    }

    if (input.userId !== undefined && view.userId !== input.userId) {
      throw new OrderNotOwnedError()
    }

    return view
  }
}

@Injectable()
export class ListOrdersUseCase implements UseCase<ListOrdersQuery, PaginatedOrdersView> {
  constructor(@Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel) {}

  execute(query: ListOrdersQuery): Promise<PaginatedOrdersView> {
    return this.orderReads.list({
      ...query,
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
    })
  }
}

function clampLimit(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidInputError('limit must be a positive integer')
  }
  return Math.min(limit, MAX_LIMIT)
}

function clampOffset(offset?: number): number {
  if (offset === undefined) {
    return 0
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidInputError('offset must be a non-negative integer')
  }
  return offset
}
