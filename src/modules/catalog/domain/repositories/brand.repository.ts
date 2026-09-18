import { Brand } from '../entities/brand.aggregate'

export interface BrandRepository {
  findById(id: number): Promise<Brand | null>
  findBySlug(slug: string): Promise<Brand | null>
  findAll(): Promise<Brand[]>
  existsBySlug(slug: string, excludeId?: number): Promise<boolean>
  countProducts(id: number): Promise<number>
  save(brand: Brand): Promise<Brand>
  delete(id: number): Promise<void>
}

export const BRAND_REPOSITORY = Symbol('BrandRepository')
