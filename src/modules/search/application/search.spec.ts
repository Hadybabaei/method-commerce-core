import { ConfigService } from '@nestjs/config'
import { InvalidInputError, NotFoundError } from '@shared/domain/errors'
import { InMemorySearchEngine } from '../infrastructure/in-memory-search.engine'
import { SearchIndexerService } from './search-indexer.service'
import { ProductDocument, ProductDocumentSource } from './search.ports'
import {
  CatalogLookup,
  groupOptions,
  RecommendationsUseCase,
  SearchProductsUseCase,
  SuggestUseCase,
} from './search.use-cases'

const doc = (id: number, overrides: Partial<ProductDocument> = {}): ProductDocument => ({
  id,
  title: `دریل ${id}`,
  subTitle: null,
  slug: `p-${id}`,
  thumbnail: null,
  category: { id: 7, title: 'دریل', slug: 'drill' },
  categoryIds: [7],
  brand: { id: 2, title: 'بوش', slug: 'bosch' },
  options: [],
  priceFrom: 100,
  priceTo: 100,
  inStock: true,
  ratingAverage: 0,
  ratingCount: 0,
  salesCount: id,
  createdAt: id,
  ...overrides,
})

const lookup: CatalogLookup = {
  categoryIdBySlug: async (slug) => (slug === 'drill' ? 7 : null),
  brandIdsBySlugs: async (slugs) => (slugs.includes('bosch') ? [2] : []),
  productBySlug: async (slug) => (slug === 'p-1' ? { id: 1, categoryId: 7, brandId: 2 } : null),
}

describe('groupOptions', () => {
  it('groups name:value pairs and rejects malformed ones', () => {
    expect(groupOptions(['رنگ:قرمز', 'رنگ:آبی', 'سایز: L', 'رنگ:قرمز'])).toEqual({
      رنگ: ['قرمز', 'آبی'],
      سایز: ['L'],
    })
    expect(() => groupOptions(['رنگ'])).toThrow(InvalidInputError)
    expect(() => groupOptions([':x'])).toThrow(InvalidInputError)
  })
})

describe('search use cases', () => {
  async function setup() {
    const engine = new InMemorySearchEngine()
    await engine.replaceAll([
      doc(1),
      doc(2, { ratingAverage: 4, ratingCount: 3 }),
      doc(3, { category: { id: 8, title: 'اره', slug: 'saw' }, categoryIds: [8] }),
      doc(4, { inStock: false }),
    ])
    return engine
  }

  it('resolves slugs, defaults the sort and maps ratings', async () => {
    const engine = await setup()
    const search = new SearchProductsUseCase(engine, lookup)

    const result = await search.execute({ categorySlug: 'drill', brandSlugs: ['bosch'] })

    expect(result.items.map((item) => item.id)).toEqual([4, 2, 1])
    expect(result.items[1].rating).toEqual({ average: 4, count: 3 })
    expect(result.items[2].rating).toBeNull()
    await expect(search.execute({ categorySlug: 'nope' })).rejects.toThrow(NotFoundError)
    await expect(search.execute({ priceMin: 5, priceMax: 1 })).rejects.toThrow(InvalidInputError)
  })

  it('suggests nothing for one letter and products plus categories otherwise', async () => {
    const suggest = new SuggestUseCase(await setup())
    expect(await suggest.execute('د')).toEqual({ products: [], categories: [] })
    const result = await suggest.execute('دریل')
    expect(result.products).toHaveLength(4)
    expect(result.categories[0]).toEqual({ id: 7, title: 'دریل', count: 3 })
  })

  it('recommends in-stock best sellers of the category, then the brand, never the product itself', async () => {
    const engine = await setup()
    const recommendations = new RecommendationsUseCase(engine, lookup, {
      productIds: async () => [3, 4, 2],
    })

    expect((await recommendations.related('p-1', 8)).map((hit) => hit.id)).toEqual([2, 3])
    // Order follows co-purchases; out-of-stock 4 is skipped.
    expect((await recommendations.boughtTogether('p-1', 4)).map((hit) => hit.id)).toEqual([3, 2])
    await expect(recommendations.related('missing', 8)).rejects.toThrow(NotFoundError)
  })
})

describe('SearchIndexerService', () => {
  function setup(documents: ProductDocument[]) {
    const engine = new InMemorySearchEngine()
    const source: ProductDocumentSource = {
      all: jest.fn(async () => documents),
      byIds: jest.fn(async (ids: number[]) =>
        documents.filter((document) => ids.includes(document.id))
      ),
      productIdsForVariants: jest.fn(async () => [2]),
    }
    const config = {
      getOrThrow: () => ({ driver: 'memory', reindexOnBoot: true, refreshMinutes: 0 }),
    } as unknown as ConfigService
    return { engine, source, indexer: new SearchIndexerService(engine, source, config) }
  }

  it('builds the index on start-up', async () => {
    const { engine, indexer } = setup([doc(1), doc(2)])
    indexer.onApplicationBootstrap()
    await indexer.flush()
    expect((await engine.search({ sort: 'newest', limit: 10, offset: 0 })).total).toBe(2)
    indexer.onModuleDestroy()
  })

  it('coalesces changes, resolves variants and drops unpublished products', async () => {
    const documents = [doc(1), doc(2)]
    const { engine, source, indexer } = setup(documents)
    await engine.replaceAll([doc(1), doc(2), doc(3)])

    await indexer.onCatalogChanged({ productIds: [3], variantIds: [99], everything: false })
    indexer.onProductEvent({ payload: { productId: 1 } })
    await indexer.flush()

    expect(source.byIds).toHaveBeenCalledTimes(1)
    expect(source.byIds).toHaveBeenCalledWith([3, 2, 1])
    expect(
      (await engine.search({ sort: 'newest', limit: 10, offset: 0 })).items.map((d) => d.id)
    ).toEqual([2, 1])
  })

  it('rebuilds everything when a category or brand changes, and survives engine errors', async () => {
    const { engine, source, indexer } = setup([doc(1)])
    await indexer.onCatalogChanged({ productIds: [], variantIds: [], everything: true })
    await indexer.flush()
    expect(source.all).toHaveBeenCalled()

    jest.spyOn(engine, 'upsert').mockRejectedValueOnce(new Error('down'))
    indexer.schedule([1])
    await expect(indexer.flush()).resolves.toBeUndefined()
    expect(await indexer.rebuildNow()).toBe(1)
  })
})
