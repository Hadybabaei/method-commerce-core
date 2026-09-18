import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  SellableVariantLookup,
  SellableVariantSnapshot,
} from '../../application/ports/sellable-variant.port'

@Injectable()
export class PrismaSellableVariantLookup implements SellableVariantLookup {
  constructor(private readonly prisma: PrismaService) {}

  async findById(variantId: number): Promise<SellableVariantSnapshot | null> {
    const record = await this.prisma.product_variant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            images: { where: { thumbnail: true }, take: 1 },
          },
        },
        inventory: true,
        optionValues: {
          include: { optionValue: { include: { option: true } } },
        },
      },
    })

    if (!record) {
      return null
    }

    const availableQuantity = record.inventory.reduce(
      (sum, level) => sum + Math.max(0, level.on_hand - level.reserved),
      0
    )

    return {
      variantId: record.id,
      productId: record.productId,
      productTitle: record.product.title,
      productSlug: record.product.slug,
      productPublished: record.product.publish,
      sku: record.sku,
      isActive: record.is_active,
      unitPrice: record.sale_price ?? record.price,
      compareAtPrice: record.sale_price === null ? null : record.price,
      availableQuantity,
      options: record.optionValues.map((link) => ({
        option: link.optionValue.option.name,
        value: link.optionValue.value,
      })),
      image: record.image,
      thumbnail: record.product.images[0]?.url ?? record.image,
    }
  }
}
