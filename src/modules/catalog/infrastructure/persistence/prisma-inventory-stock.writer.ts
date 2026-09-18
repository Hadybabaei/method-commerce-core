import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { InventoryStockWriter, SetOnHandInput } from '../../application/ports/inventory-stock.port'
import { DEFAULT_INVENTORY_LOCATION } from '../../domain/inventory'
import {
  InventoryLocationNotFoundError,
  StockBelowReservedError,
  VariantNotFoundError,
} from '../../domain/errors/catalog.errors'

@Injectable()
export class PrismaInventoryStockWriter implements InventoryStockWriter {
  constructor(private readonly prisma: PrismaService) {}

  async setOnHand(input: SetOnHandInput): Promise<void> {
    const variant = await this.prisma.product_variant.findUnique({
      where: { id: input.variantId },
      select: { id: true },
    })

    if (!variant) {
      throw new VariantNotFoundError(input.variantId)
    }

    const locationId = await this.resolveLocationId(input.locationId)
    const existing = await this.prisma.inventory_level.findUnique({
      where: {
        variantId_locationId: { variantId: input.variantId, locationId },
      },
    })

    if (existing && input.onHand < existing.reserved) {
      throw new StockBelowReservedError(input.onHand, existing.reserved)
    }

    await this.prisma.inventory_level.upsert({
      where: {
        variantId_locationId: { variantId: input.variantId, locationId },
      },
      create: {
        variantId: input.variantId,
        locationId,
        on_hand: input.onHand,
        reserved: 0,
      },
      update: { on_hand: input.onHand },
    })
  }

  private async resolveLocationId(locationId?: number): Promise<number> {
    if (locationId !== undefined) {
      const location = await this.prisma.inventory_location.findUnique({
        where: { id: locationId },
      })

      if (!location || !location.is_active) {
        throw new InventoryLocationNotFoundError(locationId)
      }

      return location.id
    }

    const existing = await this.prisma.inventory_location.findUnique({
      where: { code: DEFAULT_INVENTORY_LOCATION.code },
    })

    if (existing) {
      return existing.id
    }

    const created = await this.prisma.inventory_location.create({
      data: {
        name: DEFAULT_INVENTORY_LOCATION.name,
        code: DEFAULT_INVENTORY_LOCATION.code,
        is_active: true,
      },
    })

    return created.id
  }
}
