import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  InsufficientStockForOrderError,
  InventoryLevelMissingError,
} from '../../domain/errors/ordering.errors'
import { InventoryReservationService } from '../../domain/repositories/order.repository'
import {
  StockAllocation,
  StockAllocationPlan,
} from '../../domain/value-objects/stock-allocation.vo'

type Tx = Prisma.TransactionClient

type LockedLevel = {
  variantId: number
  locationId: number
  on_hand: number
  reserved: number
}

/**
 * Holds, releases, and consumes units on `inventory_level`. Rows are locked
 * with `FOR UPDATE` inside the caller's transaction so concurrent checkouts
 * cannot oversell the same available quantity.
 */
@Injectable()
export class PrismaInventoryReservationService implements InventoryReservationService {
  async reserve(
    lines: ReadonlyArray<{ variantId: number; quantity: number }>,
    tx: unknown
  ): Promise<StockAllocationPlan> {
    const client = this.requireTx(tx)
    const allocations: StockAllocation[] = []
    const ordered = [...lines].sort((a, b) => a.variantId - b.variantId)

    for (const line of ordered) {
      const levels = await this.lockLevelsForVariant(client, line.variantId)

      let remaining = line.quantity
      for (const level of levels) {
        if (remaining <= 0) {
          break
        }

        const available = Math.max(0, level.on_hand - level.reserved)
        if (available <= 0) {
          continue
        }

        const take = Math.min(available, remaining)
        await client.inventory_level.update({
          where: {
            variantId_locationId: {
              variantId: level.variantId,
              locationId: level.locationId,
            },
          },
          data: { reserved: level.reserved + take },
        })

        allocations.push({
          variantId: line.variantId,
          locationId: level.locationId,
          quantity: take,
        })
        remaining -= take
        level.reserved += take
      }

      if (remaining > 0) {
        const available = levels.reduce(
          (sum, level) => sum + Math.max(0, level.on_hand - level.reserved),
          0
        )
        throw new InsufficientStockForOrderError(line.variantId, available, line.quantity)
      }
    }

    return StockAllocationPlan.of(allocations)
  }

  async release(plan: StockAllocationPlan, tx: unknown): Promise<void> {
    if (plan.isEmpty) {
      return
    }

    const client = this.requireTx(tx)
    const ordered = [...plan.allocations].sort(
      (a, b) => a.variantId - b.variantId || a.locationId - b.locationId
    )

    for (const row of ordered) {
      const levels = await this.lockLevelsForVariant(client, row.variantId)
      const level = levels.find((entry) => entry.locationId === row.locationId)
      if (!level) {
        throw new InventoryLevelMissingError(row.variantId, row.locationId)
      }

      await client.inventory_level.update({
        where: {
          variantId_locationId: {
            variantId: row.variantId,
            locationId: row.locationId,
          },
        },
        data: { reserved: Math.max(0, level.reserved - row.quantity) },
      })
    }
  }

  async consume(plan: StockAllocationPlan, tx: unknown): Promise<void> {
    if (plan.isEmpty) {
      return
    }

    const client = this.requireTx(tx)
    const ordered = [...plan.allocations].sort(
      (a, b) => a.variantId - b.variantId || a.locationId - b.locationId
    )

    for (const row of ordered) {
      const levels = await this.lockLevelsForVariant(client, row.variantId)
      const level = levels.find((entry) => entry.locationId === row.locationId)
      if (!level) {
        throw new InventoryLevelMissingError(row.variantId, row.locationId)
      }

      await client.inventory_level.update({
        where: {
          variantId_locationId: {
            variantId: row.variantId,
            locationId: row.locationId,
          },
        },
        data: {
          on_hand: Math.max(0, level.on_hand - row.quantity),
          reserved: Math.max(0, level.reserved - row.quantity),
        },
      })
    }
  }

  private requireTx(tx: unknown): Tx {
    if (!tx) {
      throw new Error('Inventory mutations require an open Prisma transaction')
    }
    return tx as Tx
  }

  private async lockLevelsForVariant(client: Tx, variantId: number): Promise<LockedLevel[]> {
    return client.$queryRaw<LockedLevel[]>`
      SELECT variantId, locationId, on_hand, reserved
      FROM inventory_level
      WHERE variantId = ${variantId}
      ORDER BY locationId ASC
      FOR UPDATE
    `
  }
}
