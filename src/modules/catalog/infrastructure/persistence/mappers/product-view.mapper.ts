import { Prisma } from '@prisma/client'
import { Money } from '@shared/domain/value-objects/money'
import {
  ProductDetailView,
  ProductSummaryView,
  ProductVariantView,
} from '../../../application/dto/views'

const categoryAndBrand = {
  category: { select: { id: true, title: true, slug: true } },
  brand: { select: { id: true, title: true, slug: true } },
}

/** Listing rows: enough to render a product card, and nothing more. */
export const productSummaryInclude = {
  ...categoryAndBrand,
  images: { where: { thumbnail: true }, take: 1 },
  variants: {
    where: { is_active: true },
    select: { price: true, sale_price: true },
  },
} satisfies Prisma.productInclude

export const productDetailInclude = {
  ...categoryAndBrand,
  images: { orderBy: { position: 'asc' } },
  options: {
    orderBy: { position: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  },
  variants: {
    orderBy: { id: 'asc' },
    include: {
      optionValues: { include: { optionValue: { include: { option: true } } } },
      inventory: { select: { on_hand: true, reserved: true } },
    },
  },
} satisfies Prisma.productInclude

type SummaryRecord = Prisma.productGetPayload<{ include: typeof productSummaryInclude }>
type DetailRecord = Prisma.productGetPayload<{ include: typeof productDetailInclude }>

/**
 * Effective price of a stored variant row. The same rule as
 * `ProductVariant.effectivePrice`, applied to a projection that never becomes
 * an aggregate: a sale price only exists when it is a real reduction, so there
 * is nothing to compare.
 */
function effectivePrice(variant: { price: number; sale_price: number | null }): number {
  return variant.sale_price ?? variant.price
}

export function toProductSummaryView(record: SummaryRecord): ProductSummaryView {
  const prices = record.variants.map(effectivePrice)

  return {
    id: record.id,
    title: record.title,
    subTitle: record.sub_title,
    slug: record.slug,
    published: record.publish,
    thumbnail: record.images[0]?.url ?? null,
    category: record.category,
    brand: record.brand,
    priceFrom: prices.length > 0 ? Math.min(...prices) : null,
    priceTo: prices.length > 0 ? Math.max(...prices) : null,
    createdAt: record.created_at,
  }
}

export function toProductDetailView(record: DetailRecord): ProductDetailView {
  const activePrices = record.variants
    .filter((variant) => variant.is_active)
    .map((variant) => effectivePrice(variant))

  return {
    id: record.id,
    title: record.title,
    subTitle: record.sub_title,
    slug: record.slug,
    published: record.publish,
    thumbnail: record.images.find((image) => image.thumbnail)?.url ?? record.images[0]?.url ?? null,
    category: record.category,
    brand: record.brand,
    priceFrom: activePrices.length > 0 ? Math.min(...activePrices) : null,
    priceTo: activePrices.length > 0 ? Math.max(...activePrices) : null,
    createdAt: record.created_at,
    description: record.description,
    shortDescription: record.short_description,
    weightGrams: record.weightGrams,
    images: record.images.map((image) => ({
      url: image.url,
      thumbnail: image.thumbnail,
      position: image.position,
    })),
    options: record.options.map((option) => ({
      name: option.name,
      values: option.values.map((value) => value.value),
    })),
    variants: record.variants.map(toVariantView),
  }
}

function toVariantView(variant: DetailRecord['variants'][number]): ProductVariantView {
  const price = effectivePrice(variant)
  const onSale = variant.sale_price !== null

  return {
    id: variant.id,
    sku: variant.sku,
    price,
    compareAtPrice: onSale ? variant.price : null,
    // Reuses the domain rule rather than restating the arithmetic.
    discountPercentage: Money.fromMinor(variant.price).percentageOff(Money.fromMinor(price)),
    options: variant.optionValues.map((link) => ({
      option: link.optionValue.option.name,
      value: link.optionValue.value,
    })),
    image: variant.image,
    isActive: variant.is_active,
    availableQuantity: variant.inventory.reduce(
      (sum, level) => sum + Math.max(0, level.on_hand - level.reserved),
      0
    ),
  }
}
