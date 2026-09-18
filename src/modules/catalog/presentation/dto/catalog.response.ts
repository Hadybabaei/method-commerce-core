import { ApiProperty } from '@nestjs/swagger'
import {
  BrandView,
  CategoryTreeView,
  CategoryView,
  ProductDetailView,
  ProductImageView,
  ProductOptionView,
  ProductSummaryView,
  ProductVariantView,
} from '../../application/dto/views'

export class CategoryResponse implements CategoryView {
  @ApiProperty({ example: 4 })
  id: number

  @ApiProperty({ example: 'ابزار برقی' })
  title: string

  @ApiProperty({ example: 'ابزار-برقی' })
  slug: string

  @ApiProperty({ example: 'drill', nullable: true })
  icon: string | null

  @ApiProperty({ nullable: true })
  description: string | null

  @ApiProperty({ example: 1, nullable: true, description: 'Null for a root category.' })
  parentId: number | null

  @ApiProperty({ example: 1, description: 'Number of ancestors; a root category is 0.' })
  depth: number

  @ApiProperty({ example: 0, description: 'Sort order among siblings.' })
  position: number
}

export class CategoryTreeResponse extends CategoryResponse implements CategoryTreeView {
  @ApiProperty({
    type: () => [CategoryTreeResponse],
    description: 'Nested sub-categories, in sibling order.',
  })
  children: CategoryTreeResponse[]
}

export class BrandResponse implements BrandView {
  @ApiProperty({ example: 2 })
  id: number

  @ApiProperty({ example: 'Bosch' })
  title: string

  @ApiProperty({ example: 'bosch' })
  slug: string

  @ApiProperty({ example: 'https://cdn.method-commerce.ir/brands/bosch.png', nullable: true })
  logo: string | null

  @ApiProperty({ example: 'ابزار آلمانی', nullable: true })
  description: string | null
}

/** Category and brand as they appear nested inside a product. */
export class CatalogRefResponse {
  @ApiProperty({ example: 4 })
  id: number

  @ApiProperty({ example: 'ابزار برقی' })
  title: string

  @ApiProperty({ example: 'ابزار-برقی' })
  slug: string
}

export class ProductImageResponse implements ProductImageView {
  @ApiProperty({ example: 'https://cdn.method-commerce.ir/products/drill-1.jpg' })
  url: string

  @ApiProperty({ example: true })
  thumbnail: boolean

  @ApiProperty({ example: 0 })
  position: number
}

export class ProductOptionResponse implements ProductOptionView {
  @ApiProperty({ example: 'رنگ', description: 'An axis this product varies on.' })
  name: string

  @ApiProperty({ example: ['قرمز', 'آبی'], description: 'Values a variant may take.' })
  values: string[]
}

export class VariantOptionResponse {
  @ApiProperty({ example: 'رنگ' })
  option: string

  @ApiProperty({ example: 'قرمز' })
  value: string
}

export class ProductVariantResponse implements ProductVariantView {
  @ApiProperty({ example: 11 })
  id: number

  @ApiProperty({ example: 'DRL-RED-L', description: 'Stable identifier for this variant.' })
  sku: string

  @ApiProperty({ example: 2_400_000, description: 'What the customer pays, in Rial.' })
  price: number

  @ApiProperty({
    example: 3_000_000,
    nullable: true,
    description: 'Regular price, present only while the variant is on sale.',
  })
  compareAtPrice: number | null

  @ApiProperty({ example: 20, description: 'Derived from the two prices; 0 when not on sale.' })
  discountPercentage: number

  @ApiProperty({
    type: [VariantOptionResponse],
    description: 'One value for each option the product declares.',
  })
  options: VariantOptionResponse[]

  @ApiProperty({ nullable: true })
  image: string | null

  @ApiProperty({ example: true })
  isActive: boolean

  @ApiProperty({
    example: 12,
    description: 'Units still sellable (on_hand − reserved) across warehouses.',
  })
  availableQuantity: number
}

export class ProductSummaryResponse implements ProductSummaryView {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'دریل شارژی بوش' })
  title: string

  @ApiProperty({ nullable: true })
  subTitle: string | null

  @ApiProperty({ example: 'دریل-شارژی-بوش' })
  slug: string

  @ApiProperty({ example: true })
  published: boolean

  @ApiProperty({ example: 'https://cdn.method-commerce.ir/products/drill-1.jpg', nullable: true })
  thumbnail: string | null

  @ApiProperty({ type: CatalogRefResponse, nullable: true })
  category: CatalogRefResponse | null

  @ApiProperty({ type: CatalogRefResponse, nullable: true })
  brand: CatalogRefResponse | null

  @ApiProperty({
    example: 2_400_000,
    nullable: true,
    description: 'Cheapest active variant, in Rial. Null until the product has one.',
  })
  priceFrom: number | null

  @ApiProperty({ example: 3_000_000, nullable: true, description: 'Dearest active variant.' })
  priceTo: number | null

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  createdAt: Date
}

export class ProductDetailResponse extends ProductSummaryResponse implements ProductDetailView {
  @ApiProperty({ nullable: true })
  description: string | null

  @ApiProperty({ nullable: true })
  shortDescription: string | null

  @ApiProperty({ example: 1800, description: 'Shipping weight in grams.' })
  weightGrams: number

  @ApiProperty({ type: [ProductImageResponse] })
  images: ProductImageResponse[]

  @ApiProperty({ type: [ProductOptionResponse] })
  options: ProductOptionResponse[]

  @ApiProperty({ type: [ProductVariantResponse] })
  variants: ProductVariantResponse[]
}
