export interface SetOnHandInput {
  variantId: number
  onHand: number
  locationId?: number
}

/**
 * Admin writes of on-hand quantity. Ordering still owns reserve / release /
 * consume so checkout races stay in one place.
 */
export interface InventoryStockWriter {
  setOnHand(input: SetOnHandInput): Promise<void>
}

export const INVENTORY_STOCK_WRITER = Symbol('InventoryStockWriter')
