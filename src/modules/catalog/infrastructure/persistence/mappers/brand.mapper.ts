import { brand as BrandRecord } from '@prisma/client'
import { Brand } from '../../../domain/entities/brand.aggregate'
import { Slug } from '../../../domain/value-objects/slug.vo'

export type { BrandRecord }

export function toDomainBrand(record: BrandRecord): Brand {
  return Brand.fromPersistence(record.id, {
    title: record.title,
    slug: Slug.fromPersistence(record.slug),
    logo: record.logo,
    description: record.description,
  })
}

export function toBrandWriteData(brand: Brand) {
  return {
    title: brand.title,
    slug: brand.slug.value,
    logo: brand.logo,
    description: brand.description,
  }
}
