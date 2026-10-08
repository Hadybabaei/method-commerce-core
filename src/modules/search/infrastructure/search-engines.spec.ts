import { ProductDocument, ProductSearchQuery } from '../application/search.ports'
import { InMemorySearchEngine } from './in-memory-search.engine'
import { buildFilter, MeilisearchEngine, quote } from './meilisearch.engine'

function doc(id: number, overrides: Partial<ProductDocument> = {}): ProductDocument {
  return {
    id,
    title: `کالا ${id}`,
    subTitle: null,
    slug: `p-${id}`,
    thumbnail: null,
    category: { id: 7, title: 'دریل', slug: 'drill' },
    categoryIds: [1, 7],
    brand: { id: 2, title: 'بوش', slug: 'bosch' },
    options: [],
    priceFrom: 1_000_000,
    priceTo: 1_000_000,
    inStock: true,
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    createdAt: id * 1000,
    ...overrides,
  }
}

const query = (overrides: Partial<ProductSearchQuery> = {}): ProductSearchQuery => ({
  sort: 'relevance',
  limit: 20,
  offset: 0,
  ...overrides,
})

describe('InMemorySearchEngine', () => {
  async function engine() {
    const search = new InMemorySearchEngine()
    await search.replaceAll([
      doc(1, {
        title: 'دريل شارژي بوش',
        options: ['رنگ:آبی', 'ولتاژ:18'],
        priceFrom: 3_000_000,
        salesCount: 5,
      }),
      doc(2, {
        title: 'دریل چکشی ماکیتا',
        brand: { id: 3, title: 'ماکیتا', slug: 'makita' },
        options: ['رنگ:سبز'],
        priceFrom: 5_000_000,
        ratingAverage: 4.5,
        ratingCount: 2,
      }),
      doc(3, {
        title: 'کتاب‌خانه چوبی',
        category: { id: 9, title: 'مبلمان', slug: 'furniture' },
        categoryIds: [9],
        brand: null,
        inStock: false,
        priceFrom: null,
      }),
    ])
    return search
  }

  it('matches across Arabic/Persian letters and half-spaces, by word prefix', async () => {
    const search = await engine()
    expect((await search.search(query({ q: 'دریل شارژی' }))).items.map((d) => d.id)).toEqual([1])
    expect((await search.search(query({ q: 'دري' }))).items.map((d) => d.id).sort()).toEqual([1, 2])
    expect((await search.search(query({ q: 'کتابخانه' }))).items.map((d) => d.id)).toEqual([3])
    expect((await search.search(query({ q: 'کتاب خانه' }))).items.map((d) => d.id)).toEqual([3])
    expect((await search.search(query({ q: 'ماکیتا' }))).items.map((d) => d.id)).toEqual([2])
    expect((await search.search(query({ q: 'یخچال' }))).total).toBe(0)
  })

  it('filters by category subtree, brands, options, price and stock', async () => {
    const search = await engine()
    const ids = async (q: Partial<ProductSearchQuery>) =>
      (await search.search(query(q))).items.map((d) => d.id).sort()
    expect(await ids({ categoryId: 1 })).toEqual([1, 2])
    expect(await ids({ brandIds: [3] })).toEqual([2])
    expect(await ids({ options: { رنگ: ['آبی', 'سبز'] } })).toEqual([1, 2])
    expect(await ids({ options: { رنگ: ['آبی', 'سبز'], ولتاژ: ['18'] } })).toEqual([1])
    expect(await ids({ priceMin: 4_000_000 })).toEqual([2])
    expect(await ids({ inStockOnly: true })).toEqual([1, 2])
    expect(await ids({ onlyIds: [2, 3], excludeIds: [3] })).toEqual([2])
  })

  it('sorts by price, sales and rating, with unpriced products last', async () => {
    const search = await engine()
    const order = async (sort: ProductSearchQuery['sort']) =>
      (await search.search(query({ sort }))).items.map((d) => d.id)
    expect(await order('price_asc')).toEqual([1, 2, 3])
    expect(await order('price_desc')).toEqual([2, 1, 3])
    expect((await order('best_selling'))[0]).toBe(1)
    expect((await order('rating'))[0]).toBe(2)
    expect(await order('newest')).toEqual([3, 2, 1])
  })

  it('counts brands and option values as if their own filter were off', async () => {
    const search = await engine()
    const result = await search.search(query({ brandIds: [2], options: { رنگ: ['آبی'] } }))
    expect(result.items.map((d) => d.id)).toEqual([1])
    expect(result.facets.brands).toEqual([{ value: 2, label: 'بوش', count: 1 }])
    const colours = result.facets.options.find((group) => group.name === 'رنگ')!
    expect(colours.values.map((v) => v.value)).toEqual(['آبی'])
    const all = await search.search(query({ options: { رنگ: ['آبی'] } }))
    expect(all.facets.brands.map((b) => b.value)).toEqual([2])
    expect(
      all.facets.options
        .find((group) => group.name === 'رنگ')!
        .values.map((v) => v.value)
        .sort()
    ).toEqual(['آبی', 'سبز'])
    expect(all.facets.price).toEqual({ min: 3_000_000, max: 3_000_000 })
  })

  it('pages and removes documents', async () => {
    const search = await engine()
    const page = await search.search(query({ sort: 'newest', limit: 2, offset: 2 }))
    expect(page).toMatchObject({ total: 3, limit: 2, offset: 2 })
    expect(page.items.map((d) => d.id)).toEqual([1])
    await search.remove([1])
    expect((await search.search(query())).total).toBe(2)
  })
})

describe('buildFilter', () => {
  it('quotes option values and can leave one group out', () => {
    const q = query({
      categoryId: 7,
      brandIds: [2, 3],
      options: { رنگ: ['آبی', 'قر"مز'] },
      priceMin: 10,
      priceMax: 20,
      inStockOnly: true,
      excludeIds: [5],
    })
    expect(buildFilter(q)).toEqual([
      'categoryIds = 7',
      'brandId IN [2, 3]',
      'options IN ["رنگ:آبی", "رنگ:قر\\"مز"]',
      'priceFrom >= 10',
      'priceFrom <= 20',
      'inStock = true',
      'id NOT IN [5]',
    ])
    expect(buildFilter(q, 'brand')).not.toContain('brandId IN [2, 3]')
    expect(buildFilter(q, 'option:رنگ').some((clause) => clause.startsWith('options'))).toBe(false)
    expect(quote('a\\b')).toBe('"a\\\\b"')
  })
})

describe('MeilisearchEngine', () => {
  function fakeFetch(responses: Record<string, unknown>) {
    const calls: { method: string; path: string; body: unknown }[] = []
    const fetcher = jest.fn(async (url: string, init: { method: string; body?: string }) => {
      const path = url.replace('http://meili:7700', '')
      calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined })
      const key = Object.keys(responses).find((prefix) =>
        `${init.method} ${path}`.startsWith(prefix)
      )
      const payload = key ? responses[key] : { taskUid: 1 }
      return { ok: true, status: 200, json: async () => payload, text: async () => '' }
    })
    return { calls, fetcher: fetcher as unknown as typeof fetch }
  }

  it('sends one disjunctive query per selected group and maps facets back', async () => {
    const stored = {
      ...doc(1),
      title_n: 'x',
      title_j: 'x',
      other_n: '',
      brandId: 2,
      brandFacet: '2|بوش',
      categoryFacet: '7|دریل',
    }
    const { calls, fetcher } = fakeFetch({
      'GET /tasks/': { status: 'succeeded' },
      'POST /multi-search': {
        results: [
          {
            hits: [stored],
            totalHits: 1,
            facetDistribution: {
              brandFacet: { '2|بوش': 1 },
              categoryFacet: { '7|دریل': 1 },
              options: { 'رنگ:آبی': 1 },
            },
            facetStats: { priceFrom: { min: 1_000_000, max: 1_000_000 } },
          },
          { hits: [], facetDistribution: { brandFacet: { '2|بوش': 1, '3|ماکیتا': 4 } } },
        ],
      },
    })
    const engine = new MeilisearchEngine(
      { url: 'http://meili:7700/', apiKey: 'k', index: 'products' },
      fetcher
    )

    const result = await engine.search(query({ q: 'دريل', brandIds: [2], limit: 10, offset: 10 }))

    const multi = calls.find((call) => call.path === '/multi-search')!.body as {
      queries: { q: string; page?: number; filter: string[] }[]
    }
    expect(multi.queries).toHaveLength(2)
    expect(multi.queries[0]).toMatchObject({ q: 'دریل', page: 2, filter: ['brandId IN [2]'] })
    expect(multi.queries[1].filter).toEqual([])
    expect(result.items[0]).toEqual(doc(1))
    expect(result.offset).toBe(10)
    expect(result.facets.brands).toEqual([
      { value: 3, label: 'ماکیتا', count: 4 },
      { value: 2, label: 'بوش', count: 1 },
    ])
    expect(result.facets.options).toEqual([
      { name: 'رنگ', values: [{ value: 'آبی', label: 'آبی', count: 1 }] },
    ])
    expect(result.facets.price).toEqual({ min: 1_000_000, max: 1_000_000 })
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer k' }) })
    )
  })

  it('rebuilds into a side index and swaps it in', async () => {
    const { calls, fetcher } = fakeFetch({ 'GET /tasks/': { status: 'succeeded' } })
    const engine = new MeilisearchEngine(
      { url: 'http://meili:7700', apiKey: null, index: 'products' },
      fetcher
    )

    await engine.replaceAll([doc(1), doc(2)])

    const writes = calls
      .filter((call) => call.method !== 'GET')
      .map((call) => `${call.method} ${call.path}`)
    expect(writes).toContain('POST /indexes/products_rebuild/documents')
    expect(writes).toContain('POST /swap-indexes')
    expect(writes[writes.length - 1]).toBe('DELETE /indexes/products_rebuild')
    const added = calls.find((call) => call.path === '/indexes/products_rebuild/documents')!
      .body as { title_n: string }[]
    expect(added[0].title_n).toBe('کالا 1')
  })

  it('reports a failed task', async () => {
    const { fetcher } = fakeFetch({
      'GET /tasks/': { status: 'failed', error: { message: 'bad' } },
    })
    const engine = new MeilisearchEngine(
      { url: 'http://meili:7700', apiKey: null, index: 'products' },
      fetcher
    )
    await expect(engine.upsert([doc(1)])).rejects.toThrow('failed: bad')
  })
})
