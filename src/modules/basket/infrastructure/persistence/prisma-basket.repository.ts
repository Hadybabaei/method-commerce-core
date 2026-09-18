import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Basket } from '../../domain/entities/basket.aggregate'
import { BasketItem } from '../../domain/entities/basket-item.entity'
import { BasketRepository } from '../../domain/repositories/basket.repository'

type Client = Prisma.TransactionClient | PrismaService

@Injectable()
export class PrismaBasketRepository implements BasketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: number, tx?: unknown): Promise<Basket | null> {
    const client = this.client(tx)
    const record = await client.basket.findUnique({
      where: { userId },
      include: { items: true },
    })

    if (!record) {
      return null
    }

    return Basket.fromPersistence(
      record.id,
      record.userId,
      record.items.map((item) => BasketItem.fromPersistence(item.variantId, item.quantity))
    )
  }

  async lockByUserId(userId: number, tx: unknown): Promise<Basket | null> {
    const client = this.requireTx(tx)
    const locked = await client.$queryRaw<{ id: number }[]>`
      SELECT id FROM basket WHERE userId = ${userId} FOR UPDATE
    `
    if (locked.length === 0) {
      return null
    }

    await client.$queryRaw`
      SELECT id FROM basket_item WHERE basketId = ${locked[0].id} FOR UPDATE
    `

    return this.findByUserId(userId, tx)
  }

  async save(basket: Basket, tx?: unknown): Promise<Basket> {
    const client = this.client(tx)

    if (basket.isNew) {
      const created = await client.basket.create({
        data: {
          userId: basket.userId,
          items: {
            create: basket.getItems().map((item) => ({
              variantId: item.variantId,
              quantity: item.quantityValue,
            })),
          },
        },
        include: { items: true },
      })

      return Basket.fromPersistence(
        created.id,
        created.userId,
        created.items.map((item) => BasketItem.fromPersistence(item.variantId, item.quantity))
      )
    }

    await this.replaceItems(client, basket)

    const saved = await client.basket.findUnique({
      where: { id: basket.id },
      include: { items: true },
    })

    return Basket.fromPersistence(
      saved!.id,
      saved!.userId,
      saved!.items.map((item) => BasketItem.fromPersistence(item.variantId, item.quantity))
    )
  }

  private async replaceItems(client: Client, basket: Basket): Promise<void> {
    await client.basket_item.deleteMany({ where: { basketId: basket.id } })
    if (basket.getItems().length > 0) {
      await client.basket_item.createMany({
        data: basket.getItems().map((item) => ({
          basketId: basket.id,
          variantId: item.variantId,
          quantity: item.quantityValue,
        })),
      })
    }
    await client.basket.update({
      where: { id: basket.id },
      data: { updated_at: new Date() },
    })
  }

  private client(tx?: unknown): Client {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma
  }

  private requireTx(tx: unknown): Prisma.TransactionClient {
    if (!tx) {
      throw new Error('Basket lock requires an open Prisma transaction')
    }
    return tx as Prisma.TransactionClient
  }
}
