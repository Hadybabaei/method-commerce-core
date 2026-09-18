import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import {
  PrismaService,
  PrismaTransaction,
} from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Product } from '../../domain/entities/product.aggregate'
import { ProductRepository } from '../../domain/repositories/product.repository'
import {
  productAggregateInclude,
  toDomainProduct,
  toProductWriteData,
} from './mappers/product.mapper'

/** Key used to look an option value up by the names the domain speaks in. */
function valueKey(option: string, value: string): string {
  return `${option.toLowerCase()}:${value.toLowerCase()}`
}

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { id },
      include: productAggregateInclude,
    })

    return record ? toDomainProduct(record) : null
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { slug },
      include: productAggregateInclude,
    })

    return record ? toDomainProduct(record) : null
  }

  async existsBySlug(slug: string, excludeId?: number): Promise<boolean> {
    const found = await this.prisma.product.findFirst({
      where: { slug, ...(excludeId === undefined ? {} : { id: { not: excludeId } }) },
      select: { id: true },
    })

    return found !== null
  }

  async existsBySku(sku: string, excludeVariantId?: number): Promise<boolean> {
    const found = await this.prisma.product_variant.findFirst({
      where: {
        sku,
        ...(excludeVariantId === undefined ? {} : { id: { not: excludeVariantId } }),
      },
      select: { id: true },
    })

    return found !== null
  }

  /**
   * Writes the whole aggregate in one transaction: the product row, its
   * images, the options it declares and its variants. Anything the aggregate
   * no longer holds is removed, so the database always mirrors the in-memory
   * state the domain just validated.
   */
  async save(product: Product): Promise<Product> {
    const record = await this.prisma.$transaction(async (tx) => {
      const data = toProductWriteData(product)
      const saved = product.isNew
        ? await tx.product.create({ data })
        : await tx.product.update({ where: { id: product.id }, data })

      await this.syncImages(tx, saved.id, product)
      const optionValueIds = await this.syncOptions(tx, saved.id, product)
      await this.syncVariants(tx, saved.id, product, optionValueIds)

      return tx.product.findUniqueOrThrow({
        where: { id: saved.id },
        include: productAggregateInclude,
      })
    })

    await this.events.publish(product.pullDomainEvents())

    return toDomainProduct(record)
  }

  async delete(id: number): Promise<void> {
    await this.prisma.product.delete({ where: { id } })
  }

  /** Images carry no state worth preserving, so the list is simply replaced. */
  private async syncImages(
    tx: PrismaTransaction,
    productId: number,
    product: Product
  ): Promise<void> {
    await tx.product_image.deleteMany({ where: { productId } })

    if (product.images.length === 0) {
      return
    }

    await tx.product_image.createMany({
      data: product.images.map((image) => ({
        productId,
        url: image.url,
        thumbnail: image.isThumbnail,
        position: image.position,
      })),
    })
  }

  private async syncOptions(
    tx: PrismaTransaction,
    productId: number,
    product: Product
  ): Promise<Map<string, number>> {
    const keptNames = product.options.map((option) => option.name)

    await tx.product_option.deleteMany({
      where: { productId, name: { notIn: keptNames.length > 0 ? keptNames : [''] } },
    })

    const optionValueIds = new Map<string, number>()

    for (const option of product.options) {
      const saved = await tx.product_option.upsert({
        where: { productId_name: { productId, name: option.name } },
        create: { productId, name: option.name, position: option.position },
        update: { position: option.position },
      })

      const keptValues = option.values.map((value) => value.value)

      await tx.product_option_value.deleteMany({
        where: {
          optionId: saved.id,
          value: { notIn: keptValues.length > 0 ? keptValues : [''] },
        },
      })

      for (const value of option.values) {
        const savedValue = await tx.product_option_value.upsert({
          where: { optionId_value: { optionId: saved.id, value: value.value } },
          create: { optionId: saved.id, value: value.value, position: value.position },
          update: { position: value.position },
        })

        optionValueIds.set(valueKey(option.name, value.value), savedValue.id)
      }
    }

    return optionValueIds
  }

  private async syncVariants(
    tx: PrismaTransaction,
    productId: number,
    product: Product,
    optionValueIds: Map<string, number>
  ): Promise<void> {
    const keptSignatures = product.variants.map((variant) => variant.signature)

    await tx.product_variant.deleteMany({
      where: {
        productId,
        option_signature: { notIn: keptSignatures.length > 0 ? keptSignatures : [''] },
      },
    })

    for (const variant of product.variants) {
      const links = variant.selection.selections.map((selection) => {
        const optionValueId = optionValueIds.get(valueKey(selection.option, selection.value))

        if (optionValueId === undefined) {
          // The aggregate validates the selection before we get here, so this
          // can only mean the option sync above did not run for it.
          throw new Error(
            `Option value "${selection.option}: ${selection.value}" was not saved for product ${productId}`
          )
        }

        return { optionValueId }
      })

      await tx.product_variant.upsert({
        where: {
          productId_option_signature: { productId, option_signature: variant.signature },
        },
        create: {
          productId,
          sku: variant.sku.value,
          option_signature: variant.signature,
          price: variant.price.amount,
          sale_price: variant.salePrice?.amount ?? null,
          weightGrams: variant.weightGrams,
          image: variant.image,
          is_active: variant.isActive,
          optionValues: { create: links },
        },
        update: {
          sku: variant.sku.value,
          price: variant.price.amount,
          sale_price: variant.salePrice?.amount ?? null,
          weightGrams: variant.weightGrams,
          image: variant.image,
          is_active: variant.isActive,
        },
      })
    }
  }
}
