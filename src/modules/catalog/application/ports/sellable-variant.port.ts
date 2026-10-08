/**
 * A variant the storefront is allowed to sell right now — enough for the
 * basket to validate stock and render a line without loading a full product
 * aggregate.
 */
export interface SellableVariantSnapshot {
  variantId: number
  productId: number
  productTitle: string
  /** For promotion scope: the product category, its ancestor path ("/1/7/") and brand. */
  categoryId: number | null
  categoryPath: string | null
  brandId: number | null
  productSlug: string
  productPublished: boolean
  sku: string
  isActive: boolean
  /** What the customer pays per unit, in Rial. */
  unitPrice: number
  compareAtPrice: number | null
  /** Shipping weight of one unit: the variant's own, else the product's. */
  weightGrams: number
  /** Exempt goods carry no VAT. */
  taxExempt: boolean
  /** sum(max(0, on_hand − reserved)) across locations. */
  availableQuantity: number
  options: { option: string; value: string }[]
  image: string | null
  thumbnail: string | null
}

export interface SellableVariantLookup {
  findById(variantId: number): Promise<SellableVariantSnapshot | null>
}

export const SELLABLE_VARIANT_LOOKUP = Symbol('SellableVariantLookup')
