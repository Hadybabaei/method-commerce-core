import { SeoMeta } from '../../../domain/value-objects/seo-meta.vo'
import { category as CategoryRecord } from '@prisma/client'
import { Category } from '../../../domain/entities/category.aggregate'
import { CategoryPath } from '../../../domain/value-objects/category-path.vo'
import { Slug } from '../../../domain/value-objects/slug.vo'

export type { CategoryRecord }

export function toDomainCategory(record: CategoryRecord): Category {
  return Category.fromPersistence(record.id, {
    title: record.title,
    slug: Slug.fromPersistence(record.slug),
    icon: record.icon,
    description: record.description,
    seo: SeoMeta.fromPersistence(record.seo_title, record.seo_description),
    parentId: record.parentId,
    path: CategoryPath.fromPersistence(record.path),
    position: record.position,
  })
}

export function toCategoryWriteData(category: Category) {
  return {
    title: category.title,
    slug: category.slug.value,
    icon: category.icon,
    description: category.description,
    seo_title: category.seo.title,
    seo_description: category.seo.description,
    parentId: category.parentId,
    path: category.path.value,
    depth: category.depth,
    position: category.position,
  }
}
