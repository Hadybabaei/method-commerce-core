import { Injectable } from '@nestjs/common'
import { Prisma, shipping_method } from '@prisma/client'
import { isUnsaved } from '@shared/domain/identifier'
import { Money } from '@shared/domain/value-objects/money'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { isUniqueConstraintError } from '@shared/infrastructure/persistence/prisma/prisma-errors'
import { ShippingMethod } from '../../domain/entities/shipping-method.entity'
import { ShippingMethodCodeTakenError } from '../../domain/errors/ordering.errors'
import { ShippingMethodRepository } from '../../domain/repositories/shipping-method.repository'

const ordering: Prisma.shipping_methodOrderByWithRelationInput[] = [
  { position: 'asc' },
  { id: 'asc' },
]

@Injectable()
export class PrismaShippingMethodRepository implements ShippingMethodRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<ShippingMethod | null> {
    const record = await this.prisma.shipping_method.findUnique({ where: { id } })
    return record ? toDomain(record) : null
  }

  async findByCode(code: string): Promise<ShippingMethod | null> {
    const record = await this.prisma.shipping_method.findUnique({ where: { code } })
    return record ? toDomain(record) : null
  }

  async list(): Promise<ShippingMethod[]> {
    const records = await this.prisma.shipping_method.findMany({ orderBy: ordering })
    return records.map(toDomain)
  }

  async listActive(): Promise<ShippingMethod[]> {
    const records = await this.prisma.shipping_method.findMany({
      where: { is_active: true },
      orderBy: ordering,
    })
    return records.map(toDomain)
  }

  async save(method: ShippingMethod): Promise<ShippingMethod> {
    const data = {
      name: method.name,
      code: method.code,
      description: method.description,
      base_fee: method.baseFee.amount,
      per_kg_fee: method.perKgFee.amount,
      free_above: method.freeAbove?.amount ?? null,
      min_days: method.minDays,
      max_days: method.maxDays,
      province_ids: method.provinceIds ?? Prisma.DbNull,
      tracking_url_template: method.trackingUrlTemplate,
      is_active: method.isActive,
      position: method.position,
    }

    try {
      const record = isUnsaved(method.id)
        ? await this.prisma.shipping_method.create({ data })
        : await this.prisma.shipping_method.update({ where: { id: method.id }, data })
      return toDomain(record)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ShippingMethodCodeTakenError(method.code)
      }
      throw error
    }
  }

  async delete(id: number): Promise<void> {
    await this.prisma.shipping_method.delete({ where: { id } })
  }
}

function toDomain(record: shipping_method): ShippingMethod {
  return ShippingMethod.fromPersistence(record.id, {
    name: record.name,
    code: record.code,
    description: record.description,
    baseFee: Money.fromMinor(record.base_fee),
    perKgFee: Money.fromMinor(record.per_kg_fee),
    freeAbove: record.free_above === null ? null : Money.fromMinor(record.free_above),
    minDays: record.min_days,
    maxDays: record.max_days,
    provinceIds: Array.isArray(record.province_ids) ? (record.province_ids as number[]) : null,
    trackingUrlTemplate: record.tracking_url_template,
    isActive: record.is_active,
    position: record.position,
  })
}
