export interface StockAllocation {
  variantId: number
  locationId: number
  quantity: number
}

/**
 * How reserved units are spread across warehouses for one order. Cancel uses
 * the same list so `inventory_level.reserved` comes back down exactly.
 */
export class StockAllocationPlan {
  private constructor(readonly allocations: readonly StockAllocation[]) {}

  static empty(): StockAllocationPlan {
    return new StockAllocationPlan([])
  }

  static of(allocations: StockAllocation[]): StockAllocationPlan {
    return new StockAllocationPlan(allocations)
  }

  get isEmpty(): boolean {
    return this.allocations.length === 0
  }

  toJSON(): StockAllocation[] {
    return this.allocations.map((row) => ({ ...row }))
  }

  static fromJSON(raw: unknown): StockAllocationPlan {
    if (!Array.isArray(raw)) {
      return StockAllocationPlan.empty()
    }

    return StockAllocationPlan.of(
      raw.map((row) => ({
        variantId: Number(row.variantId),
        locationId: Number(row.locationId),
        quantity: Number(row.quantity),
      }))
    )
  }
}
