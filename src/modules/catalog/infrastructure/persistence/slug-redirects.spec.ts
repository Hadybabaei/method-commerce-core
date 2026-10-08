import { PrismaTransaction } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { SlugRedirectType, currentSlug, recordSlugChange } from './slug-redirects'

function fakeTx() {
  const tx = {
    slug_redirect: { deleteMany: jest.fn(), upsert: jest.fn() },
    product: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    brand: { findUnique: jest.fn() },
  }
  return { tx, client: tx as unknown as PrismaTransaction }
}

describe('slug redirects', () => {
  it('points the old slug at the entry and frees the new one', async () => {
    const { tx, client } = fakeTx()

    await recordSlugChange(client, SlugRedirectType.PRODUCT, 7, 'old-drill', 'new-drill')

    expect(tx.slug_redirect.deleteMany).toHaveBeenCalledWith({
      where: { type: SlugRedirectType.PRODUCT, old_slug: 'new-drill' },
    })
    expect(tx.slug_redirect.upsert).toHaveBeenCalledWith({
      where: { type_old_slug: { type: SlugRedirectType.PRODUCT, old_slug: 'old-drill' } },
      create: { type: SlugRedirectType.PRODUCT, old_slug: 'old-drill', targetId: 7 },
      update: { targetId: 7 },
    })
  })

  it.each([
    ['a new entry', null],
    ['an unchanged slug', 'drill'],
  ])('only frees the slug for %s', async (_, previous) => {
    const { tx, client } = fakeTx()

    await recordSlugChange(client, SlugRedirectType.BRAND, 3, previous, 'drill')

    expect(tx.slug_redirect.deleteMany).toHaveBeenCalledTimes(1)
    expect(tx.slug_redirect.upsert).not.toHaveBeenCalled()
  })

  it('reads the stored slug from the right table', async () => {
    const { tx, client } = fakeTx()
    tx.category.findUnique.mockResolvedValue({ slug: 'tools' })

    await expect(currentSlug(client, SlugRedirectType.CATEGORY, 4)).resolves.toBe('tools')
    expect(tx.category.findUnique).toHaveBeenCalledWith({
      where: { id: 4 },
      select: { slug: true },
    })
    expect(tx.product.findUnique).not.toHaveBeenCalled()

    tx.brand.findUnique.mockResolvedValue(null)
    await expect(currentSlug(client, SlugRedirectType.BRAND, 9)).resolves.toBeNull()
  })
})
