import { Order } from '../entities/order.aggregate'
import { StockAllocationPlan } from '../value-objects/stock-allocation.vo'

export interface OrderRepository {
  findById(id: number): Promise<Order | null>

  findByNumber(number: string): Promise<Order | null>

  /** Persists a new order together with its lines. */
  create(order: Order, tx?: unknown): Promise<Order>

  /** Persists status / reservation changes on an existing order. */
  save(order: Order, tx?: unknown): Promise<Order>

  /** Next sequence fragment for the daily order number (must run inside tx). */
  nextDailySequence(dayKey: string, tx?: unknown): Promise<number>
}

export const ORDER_REPOSITORY = Symbol('OrderRepository')

export interface InventoryReservationService {
  reserve(
    lines: ReadonlyArray<{ variantId: number; quantity: number }>,
    tx: unknown
  ): Promise<StockAllocationPlan>

  release(plan: StockAllocationPlan, tx: unknown): Promise<void>

  /** Decrements both on_hand and reserved after a successful payment. */
  consume(plan: StockAllocationPlan, tx: unknown): Promise<void>
}

export const INVENTORY_RESERVATION = Symbol('InventoryReservationService')
