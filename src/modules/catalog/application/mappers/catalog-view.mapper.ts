import { Brand } from '../../domain/entities/brand.aggregate'
import { Category } from '../../domain/entities/category.aggregate'
import { BrandView, CategoryTreeView, CategoryView } from '../dto/views'

export function toCategoryView(category: Category): CategoryView {
  return {
    id: category.id,
    title: category.title,
    slug: category.slug.value,
    icon: category.icon,
    description: category.description,
    parentId: category.parentId,
    depth: category.depth,
    position: category.position,
  }
}

/**
 * Nests a flat list into a tree in one pass.
 *
 * The flat list is a single query, so the tree costs one round trip no matter
 * how deep it is.
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeView[] {
  const nodes = new Map<number, CategoryTreeView>()

  for (const category of categories) {
    nodes.set(category.id, { ...toCategoryView(category), children: [] })
  }

  const roots: CategoryTreeView[] = []

  for (const category of categories) {
    const node = nodes.get(category.id)

    if (!node) continue

    const parent = category.parentId === null ? undefined : nodes.get(category.parentId)

    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function toBrandView(brand: Brand): BrandView {
  return {
    id: brand.id,
    title: brand.title,
    slug: brand.slug.value,
    logo: brand.logo,
    description: brand.description,
  }
}
