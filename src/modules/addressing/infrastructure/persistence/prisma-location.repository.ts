import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { City, Province } from '../../domain/entities/location'
import { LocationRepository } from '../../domain/repositories/location.repository'

@Injectable()
export class PrismaLocationRepository implements LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProvinces(): Promise<Province[]> {
    const records = await this.prisma.province.findMany({ orderBy: { name: 'asc' } })

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      slug: record.slug,
      telPrefix: record.tel_prefix,
    }))
  }

  async findProvinceById(id: number): Promise<Province | null> {
    const record = await this.prisma.province.findUnique({ where: { id } })

    if (!record) return null

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      telPrefix: record.tel_prefix,
    }
  }

  async findCitiesByProvinceId(provinceId: number): Promise<City[]> {
    const records = await this.prisma.city.findMany({
      where: { province_id: provinceId },
      orderBy: { name: 'asc' },
    })

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      slug: record.slug,
      provinceId: record.province_id,
    }))
  }

  async findCityById(id: number): Promise<City | null> {
    const record = await this.prisma.city.findUnique({ where: { id } })

    if (!record) return null

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      provinceId: record.province_id,
    }
  }
}
