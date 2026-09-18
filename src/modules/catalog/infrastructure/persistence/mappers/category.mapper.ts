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
    parentId: category.parentId,
    path: category.path.value,
    depth: category.depth,
    position: category.position,
  }
}
