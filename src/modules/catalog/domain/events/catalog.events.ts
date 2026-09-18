import { BaseDomainEvent } from '@shared/domain/domain-event'

export class ProductPublishedEvent extends BaseDomainEvent<{ productId: number; slug: string }> {
  constructor(productId: number, slug: string) {
    super('catalog.product.published', { productId, slug })
  }
}

export class ProductUnpublishedEvent extends BaseDomainEvent<{ productId: number; slug: string }> {
  constructor(productId: number, slug: string) {
    super('catalog.product.unpublished', { productId, slug })
  }
}

/**
 * Carries the prefix rewrite so that anything caching the tree — search
 * indexes, menus — knows which branch changed shape.
 */
export class CategoryMovedEvent extends BaseDomainEvent<{
  categoryId: number
  oldPrefix: string
  newPrefix: string
}> {
  constructor(categoryId: number, oldPrefix: string, newPrefix: string) {
    super('catalog.category.moved', { categoryId, oldPrefix, newPrefix })
  }
}
