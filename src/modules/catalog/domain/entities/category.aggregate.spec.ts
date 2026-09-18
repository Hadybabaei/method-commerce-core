import { CategoryCycleError, CategoryTooDeepError } from '../errors/catalog.errors'
import { CategoryPath, MAX_CATEGORY_DEPTH } from '../value-objects/category-path.vo'
import { Slug } from '../value-objects/slug.vo'
import { Category } from './category.aggregate'

function saved(id: number, path: string, parentId: number | null = null): Category {
  return Category.fromPersistence(id, {
    title: `Category ${id}`,
    slug: Slug.create(`category-${id}`),
    icon: null,
    description: null,
    parentId,
    path: CategoryPath.fromPersistence(path),
    position: 0,
  })
}

function newChildOf(parent: Category | null): Category {
  return Category.create({
    title: 'Power tools',
    slug: Slug.create('power-tools'),
    icon: null,
    description: null,
    position: 0,
    parent,
  })
}

describe('Category', () => {
  it('gives a root category an empty path', () => {
    const root = newChildOf(null)

    expect(root.path.value).toBe('/')
    expect(root.depth).toBe(0)
    expect(root.parentId).toBeNull()
  })

  it('builds a child path from its parent without needing its own id', () => {
    const parent = saved(7, '/3/', 3)
    const child = newChildOf(parent)

    expect(child.path.value).toBe('/3/7/')
    expect(child.depth).toBe(2)
    expect(child.parentId).toBe(7)
  })

  it('addresses its own subtree with a prefix', () => {
    expect(saved(12, '/1/4/').subtreePrefix).toBe('/1/4/12/')
  })

  it('refuses to nest deeper than the limit', () => {
    const deepest = saved(
      9,
      `/${Array.from({ length: MAX_CATEGORY_DEPTH }, (_, i) => i + 1).join('/')}/`
    )

    expect(deepest.depth).toBe(MAX_CATEGORY_DEPTH)
    expect(() => newChildOf(deepest)).toThrow(CategoryTooDeepError)
  })

  it('refuses to move inside itself or one of its descendants', () => {
    const category = saved(4, '/1/', 1)
    const descendant = saved(9, '/1/4/', 4)

    expect(() => category.moveTo(category, 1)).toThrow(CategoryCycleError)
    expect(() => category.moveTo(descendant, 1)).toThrow(CategoryCycleError)
  })

  it('reports the prefix rewrite its descendants need when it moves', () => {
    const category = saved(4, '/1/', 1)
    const newParent = saved(2, '/')

    const rewrite = category.moveTo(newParent, 2)

    expect(rewrite).toEqual({ oldPrefix: '/1/4/', newPrefix: '/2/4/' })
    expect(category.parentId).toBe(2)
    expect(category.path.value).toBe('/2/')
  })

  it('does nothing when the parent is unchanged', () => {
    const category = saved(4, '/1/', 1)

    expect(category.moveTo(saved(1, '/'), 1)).toBeNull()
    expect(category.pullDomainEvents()).toHaveLength(0)
  })

  it('counts the deepest descendant when checking a move', () => {
    const category = saved(4, '/1/', 1)
    const target = saved(
      8,
      `/${Array.from({ length: MAX_CATEGORY_DEPTH - 1 }, (_, i) => i + 1).join('/')}/`
    )

    // The subtree reaches one level below the category itself, which would put
    // it past the limit at the destination.
    expect(() => category.moveTo(target, category.depth + 1)).toThrow(CategoryTooDeepError)
  })
})
