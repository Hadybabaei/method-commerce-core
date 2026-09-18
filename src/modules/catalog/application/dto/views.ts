export interface CategoryView {
  id: number
  title: string
  slug: string
  icon: string | null
  description: string | null
  parentId: number | null
  depth: number
  position: number
}

export interface CategoryTreeView extends CategoryView {
  children: CategoryTreeView[]
}

export interface BrandView {
  id: number
  title: string
  slug: string
  logo: string | null
  description: string | null
}

export interface ProductImageView {
  url: string
  thumbnail: boolean
  position: number
}

export interface ProductOptionView {
  name: string
  values: string[]
}

export interface ProductVariantView {
  id: number
  sku: string
  /** What the customer pays, in Rial. */
  price: number
  /** Regular price, present only when the variant is on sale. */
  compareAtPrice: number | null
  discountPercentage: number
  options: { option: string; value: string }[]
  image: string | null
  isActive: boolean
  /** Units still sellable across locations (on_hand − reserved). */
  availableQuantity: number
}

export interface ProductSummaryView {
  id: number
  title: string
  subTitle: string | null
  slug: string
  published: boolean
  thumbnail: string | null
  category: Pick<CategoryView, 'id' | 'title' | 'slug'> | null
  brand: Pick<BrandView, 'id' | 'title' | 'slug'> | null
  /** Null until the product has at least one active variant. */
  priceFrom: number | null
  priceTo: number | null
  createdAt: Date
}

export interface ProductDetailView extends ProductSummaryView {
  description: string | null
  shortDescription: string | null
  weightGrams: number
  images: ProductImageView[]
  options: ProductOptionView[]
  variants: ProductVariantView[]
}

export interface PaginatedView<TItem> {
  items: TItem[]
  total: number
  limit: number
  offset: number
}
