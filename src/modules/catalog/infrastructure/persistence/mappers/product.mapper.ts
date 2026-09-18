import { Prisma } from '@prisma/client'
import { Money } from '@shared/domain/value-objects/money'
import { Product } from '../../../domain/entities/product.aggregate'
import { ProductOption, ProductOptionValue } from '../../../domain/entities/product-option.entity'
import { ProductVariant } from '../../../domain/entities/product-variant.entity'
import { ProductImage } from '../../../domain/value-objects/product-image.vo'
import { Sku } from '../../../domain/value-objects/sku.vo'
import { Slug } from '../../../domain/value-objects/slug.vo'
import { VariantSelection } from '../../../domain/value-objects/variant-selection.vo'

/** Everything the write model needs to rebuild a product aggregate. */
export const productAggregateInclude = {
  images: { orderBy: { position: 'asc' } },
  options: {
    orderBy: { position: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  },
  variants: {
    orderBy: { id: 'asc' },
    include: {
      optionValues: { include: { optionValue: { include: { option: true } } } },
    },
  },
} satisfies Prisma.productInclude

export type ProductRecord = Prisma.productGetPayload<{ include: typeof productAggregateInclude }>

export function toDomainProduct(record: ProductRecord): Product {
  return Product.fromPersistence(record.id, {
    title: record.title,
    subTitle: record.sub_title,
    slug: Slug.fromPersistence(record.slug),
    description: record.description,
    shortDescription: record.short_description,
    published: record.publish,
    weightGrams: record.weightGrams,
    categoryId: record.categoryId,
    brandId: record.brandId,
    images: record.images.map((image) =>
      ProductImage.create(image.url, image.thumbnail, image.position)
    ),
    options: record.options.map((option) =>
      ProductOption.fromPersistence(option.id, {
        name: option.name,
        position: option.position,
        values: option.values.map((value) =>
          ProductOptionValue.fromPersistence(value.id, {
            value: value.value,
            position: value.position,
          })
        ),
      })
    ),
    variants: record.variants.map((variant) =>
      ProductVariant.fromPersistence(variant.id, {
        sku: Sku.fromPersistence(variant.sku),
        selection: VariantSelection.create(
          variant.optionValues.map((link) => ({
            option: link.optionValue.option.name,
            value: link.optionValue.value,
          }))
        ),
        price: Money.fromMinor(variant.price),
        salePrice: variant.sale_price === null ? null : Money.fromMinor(variant.sale_price),
        weightGrams: variant.weightGrams,
        image: variant.image,
        isActive: variant.is_active,
      })
    ),
  })
}

export function toProductWriteData(product: Product) {
  return {
    title: product.title,
    sub_title: product.subTitle,
    slug: product.slug.value,
    description: product.description,
    short_description: product.shortDescription,
    publish: product.published,
    weightGrams: product.weightGrams,
    categoryId: product.categoryId,
    brandId: product.brandId,
  }
}
