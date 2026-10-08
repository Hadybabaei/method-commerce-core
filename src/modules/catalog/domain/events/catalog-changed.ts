/** Emitted after any write that changes what the storefront shows for products. */
export const CATALOG_CHANGED = 'catalog.changed'

export interface CatalogChange {
  productIds: number[]
  /** Stock or variant changes; listeners resolve them to products. */
  variantIds: number[]
  /** A category or brand changed, which every product copies. */
  everything: boolean
}
