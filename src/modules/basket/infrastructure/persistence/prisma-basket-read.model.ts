import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { BasketLineIssue, BasketLineView, BasketView } from '../../application/dto/views'
import { BasketReadModel } from '../../application/ports/basket-read.port'

@Injectable()
export class PrismaBasketReadModel implements BasketReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: number): Promise<BasketView | null> {
    const record = await this.prisma.basket.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { where: { thumbnail: true }, take: 1 } },
                },
                inventory: true,
                optionValues: {
                  include: { optionValue: { include: { option: true } } },
                },
              },
            },
          },
        },
      },
    })

    if (!record) {
      return null
    }

    const items = record.items.map((item) => toLineView(item))
    const subtotal = items
      .filter((line) => line.issues.length === 0)
      .reduce((sum, line) => sum + line.lineTotal, 0)

    return {
      id: record.id,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      items,
    }
  }
}

type ItemRecord = {
  variantId: number
  quantity: number
  variant: {
    sku: string
    price: number
    sale_price: number | null
    image: string | null
    is_active: boolean
    product: {
      id: number
      title: string
      slug: string
      publish: boolean
      images: { url: string }[]
    }
    inventory: { on_hand: number; reserved: number }[]
    optionValues: {
      optionValue: { value: string; option: { name: string } }
    }[]
  }
}

function toLineView(item: ItemRecord): BasketLineView {
  const unitPrice = item.variant.sale_price ?? item.variant.price
  const availableQuantity = item.variant.inventory.reduce(
    (sum, level) => sum + Math.max(0, level.on_hand - level.reserved),
    0
  )

  const issues: BasketLineIssue[] = []
  if (!item.variant.product.publish) {
    issues.push('UNPUBLISHED')
  }
  if (!item.variant.is_active) {
    issues.push('INACTIVE')
  }
  if (availableQuantity <= 0) {
    issues.push('OUT_OF_STOCK')
  } else if (item.quantity > availableQuantity) {
    issues.push('INSUFFICIENT_STOCK')
  }

  return {
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice,
    lineTotal: unitPrice * item.quantity,
    availableQuantity,
    product: {
      id: item.variant.product.id,
      title: item.variant.product.title,
      slug: item.variant.product.slug,
      thumbnail: item.variant.product.images[0]?.url ?? item.variant.image,
    },
    variant: {
      sku: item.variant.sku,
      options: item.variant.optionValues.map((link) => ({
        option: link.optionValue.option.name,
        value: link.optionValue.value,
      })),
      image: item.variant.image,
      isActive: item.variant.is_active,
    },
    issues,
  }
}
