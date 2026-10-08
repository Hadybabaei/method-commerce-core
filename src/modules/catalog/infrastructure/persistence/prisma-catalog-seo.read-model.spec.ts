import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { PrismaCatalogSeoReadModel } from './prisma-catalog-seo.read-model'

function setup() {
  const prisma = {
    slug_redirect: { findUnique: jest.fn() },
    product: { findFirst: jest.fn(), findMany: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    brand: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  }
  return { prisma, model: new PrismaCatalogSeoReadModel(prisma as unknown as PrismaService) }
}

describe('PrismaCatalogSeoReadModel', () => {
  it('resolves an old product slug to the published product’s current slug', async () => {
    const { prisma, model } = setup()
    prisma.slug_redirect.findUnique.mockResolvedValue({ targetId: 7 })
    prisma.product.findFirst.mockResolvedValue({ slug: 'new-drill' })

    await expect(model.resolveRedirect('product', 'old-drill')).resolves.toBe('new-drill')
    expect(prisma.slug_redirect.findUnique).toHaveBeenCalledWith({
      where: { type_old_slug: { type: 'PRODUCT', old_slug: 'old-drill' } },
      select: { targetId: true },
    })
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 7, publish: true },
      select: { slug: true },
    })
  })

  it('returns null without a redirect, for a gone or unpublished target, or a loop', async () => {
    const { prisma, model } = setup()

    prisma.slug_redirect.findUnique.mockResolvedValueOnce(null)
    await expect(model.resolveRedirect('brand', 'x')).resolves.toBeNull()

    prisma.slug_redirect.findUnique.mockResolvedValueOnce({ targetId: 7 })
    prisma.product.findFirst.mockResolvedValueOnce(null)
    await expect(model.resolveRedirect('product', 'x')).resolves.toBeNull()

    prisma.slug_redirect.findUnique.mockResolvedValueOnce({ targetId: 2 })
    prisma.category.findUnique.mockResolvedValueOnce({ slug: 'x' })
    await expect(model.resolveRedirect('category', 'x')).resolves.toBeNull()
  })

  it('lists published products, categories and brands for the sitemap', async () => {
    const { prisma, model } = setup()
    const at = new Date('2026-10-01T00:00:00Z')
    prisma.product.findMany.mockResolvedValue([{ slug: 'drill', updated_at: at }])
    prisma.category.findMany.mockResolvedValue([{ slug: 'tools', updated_at: at }])
    prisma.brand.findMany.mockResolvedValue([])

    await expect(model.sitemap()).resolves.toEqual({
      products: [{ slug: 'drill', updatedAt: at }],
      categories: [{ slug: 'tools', updatedAt: at }],
      brands: [],
    })
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publish: true } })
    )
  })
})
