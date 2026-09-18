import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Brand } from '../../domain/entities/brand.aggregate'
import { BrandRepository } from '../../domain/repositories/brand.repository'
import { toBrandWriteData, toDomainBrand } from './mappers/brand.mapper'

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Brand | null> {
    const record = await this.prisma.brand.findUnique({ where: { id } })

    return record ? toDomainBrand(record) : null
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    const record = await this.prisma.brand.findUnique({ where: { slug } })

    return record ? toDomainBrand(record) : null
  }

  async findAll(): Promise<Brand[]> {
    const records = await this.prisma.brand.findMany({ orderBy: { title: 'asc' } })

    return records.map(toDomainBrand)
  }

  async existsBySlug(slug: string, excludeId?: number): Promise<boolean> {
    const found = await this.prisma.brand.findFirst({
      where: { slug, ...(excludeId === undefined ? {} : { id: { not: excludeId } }) },
      select: { id: true },
    })

    return found !== null
  }

  countProducts(id: number): Promise<number> {
    return this.prisma.product.count({ where: { brandId: id } })
  }

  async save(brand: Brand): Promise<Brand> {
    const data = toBrandWriteData(brand)
    const record = brand.isNew
      ? await this.prisma.brand.create({ data })
      : await this.prisma.brand.update({ where: { id: brand.id }, data })

    await this.events.publish(brand.pullDomainEvents())

    return toDomainBrand(record)
  }

  async delete(id: number): Promise<void> {
    await this.prisma.brand.delete({ where: { id } })
  }
}
