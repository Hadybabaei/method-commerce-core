import { Product } from '../entities/product.aggregate'

export interface ProductRepository {
  /** Loads the whole aggregate: images, options and variants included. */
  findById(id: number): Promise<Product | null>
  findBySlug(slug: string): Promise<Product | null>
  existsBySlug(slug: string, excludeId?: number): Promise<boolean>
  existsBySku(sku: string, excludeVariantId?: number): Promise<boolean>
  save(product: Product): Promise<Product>
  delete(id: number): Promise<void>
}

export const PRODUCT_REPOSITORY = Symbol('ProductRepository')
