import { Logger } from '@nestjs/common'
import {
  FacetCount,
  ProductDocument,
  ProductSearchQuery,
  ProductSearchResult,
  SearchEngine,
  SearchFacets,
  SearchSort,
} from '../application/search.ports'
import { normalizePersian } from '../domain/persian-text'
import { searchableText } from './in-memory-search.engine'

export interface MeilisearchOptions {
  url: string
  apiKey: string | null
  index: string
  /** How long to wait for an indexing task before giving up, ms. */
  taskTimeoutMs?: number
}

/** What is stored in Meilisearch: the document plus normalised text and facet keys. */
type StoredDocument = ProductDocument & {
  title_n: string
  title_j: string
  other_n: string
  brandId: number | null
  /** "id|title" so facet counts carry their label. */
  brandFacet: string | null
  categoryFacet: string | null
}

type Group = 'brand' | `option:${string}` | 'none'

const SORT: Record<SearchSort, string[]> = {
  relevance: [],
  newest: ['createdAt:desc'],
  price_asc: ['priceFrom:asc'],
  price_desc: ['priceFrom:desc'],
  best_selling: ['salesCount:desc'],
  rating: ['ratingAverage:desc', 'ratingCount:desc'],
}

const STORED_ONLY = [
  'title_n',
  'title_j',
  'other_n',
  'brandId',
  'brandFacet',
  'categoryFacet',
] as const

/** A Meilisearch string literal. */
export function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Meilisearch filter clauses for a query, optionally leaving out one facet group. */
export function buildFilter(query: ProductSearchQuery, ignore: Group = 'none'): string[] {
  const clauses: string[] = []
  if (query.categoryId !== undefined) clauses.push(`categoryIds = ${query.categoryId}`)
  if (ignore !== 'brand' && query.brandIds?.length) {
    clauses.push(`brandId IN [${query.brandIds.join(', ')}]`)
  }
  for (const [name, values] of Object.entries(query.options ?? {})) {
    if (ignore === `option:${name}` || values.length === 0) continue
    clauses.push(`options IN [${values.map((value) => quote(`${name}:${value}`)).join(', ')}]`)
  }
  if (query.priceMin !== undefined) clauses.push(`priceFrom >= ${query.priceMin}`)
  if (query.priceMax !== undefined) clauses.push(`priceFrom <= ${query.priceMax}`)
  if (query.inStockOnly) clauses.push('inStock = true')
  if (query.onlyIds) clauses.push(`id IN [${query.onlyIds.join(', ')}]`)
  if (query.excludeIds?.length) clauses.push(`id NOT IN [${query.excludeIds.join(', ')}]`)
  return clauses
}

function toStored(document: ProductDocument): StoredDocument {
  return {
    ...document,
    title_n: searchableText.title(document),
    title_j: searchableText.titleJoined(document),
    other_n: searchableText.other(document),
    brandId: document.brand?.id ?? null,
    brandFacet: document.brand ? `${document.brand.id}|${document.brand.title}` : null,
    categoryFacet: document.category ? `${document.category.id}|${document.category.title}` : null,
  }
}

function fromStored(stored: StoredDocument): ProductDocument {
  const document = { ...stored } as Partial<StoredDocument>
  for (const key of STORED_ONLY) delete document[key]
  return document as ProductDocument
}

function labelled(distribution: Record<string, number> | undefined): FacetCount<number>[] {
  return Object.entries(distribution ?? {})
    .map(([key, count]) => {
      const bar = key.indexOf('|')
      return { value: Number(key.slice(0, bar)), label: key.slice(bar + 1), count }
    })
    .sort((a, b) => b.count - a.count)
}

interface SearchResponse {
  hits: StoredDocument[]
  totalHits?: number
  estimatedTotalHits?: number
  facetDistribution?: Record<string, Record<string, number>>
  facetStats?: Record<string, { min: number; max: number }>
}

/** Product search on a Meilisearch server, over its HTTP API. */
export class MeilisearchEngine implements SearchEngine {
  private readonly logger = new Logger(MeilisearchEngine.name)
  private configured = false

  constructor(
    private readonly options: MeilisearchOptions,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
    await this.ensureIndex(this.options.index)
    const q = query.q ? normalizePersian(query.q) : ''
    // Pages keep totals exact (offset mode only estimates them).
    const page = Math.floor(query.offset / query.limit) + 1
    const groups: Group[] = []
    if (query.brandIds?.length) groups.push('brand')
    for (const [name, values] of Object.entries(query.options ?? {})) {
      if (values.length) groups.push(`option:${name}`)
    }

    const main = {
      indexUid: this.options.index,
      q,
      filter: buildFilter(query),
      sort: SORT[query.sort],
      facets: ['brandFacet', 'categoryFacet', 'options', 'priceFrom'],
      hitsPerPage: query.limit,
      page,
    }
    // One extra query per selected group, without that group's filter, for disjunctive counts.
    const others = groups.map((group) => ({
      indexUid: this.options.index,
      q,
      filter: buildFilter(query, group),
      facets: [group === 'brand' ? 'brandFacet' : 'options'],
      limit: 0,
    }))

    const { results } = await this.request<{ results: SearchResponse[] }>('POST', '/multi-search', {
      queries: [main, ...others],
    })
    const [first, ...rest] = results
    const byGroup = new Map(groups.map((group, index) => [group, rest[index]]))

    return {
      items: first.hits.map(fromStored),
      total: first.totalHits ?? first.estimatedTotalHits ?? first.hits.length,
      limit: query.limit,
      offset: (page - 1) * query.limit,
      facets: this.facets(first, byGroup),
    }
  }

  async upsert(documents: ProductDocument[]): Promise<void> {
    if (documents.length === 0) return
    await this.ensureIndex(this.options.index)
    await this.task(
      this.request('POST', `/indexes/${this.options.index}/documents`, documents.map(toStored))
    )
  }

  async remove(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    await this.ensureIndex(this.options.index)
    await this.task(
      this.request('POST', `/indexes/${this.options.index}/documents/delete-batch`, ids)
    )
  }

  /** Builds a fresh index beside the live one and swaps them, so searches never see a half-built index. */
  async replaceAll(documents: ProductDocument[]): Promise<void> {
    const live = this.options.index
    const fresh = `${live}_rebuild`
    await this.ensureIndex(live)
    await this.task(this.request('DELETE', `/indexes/${fresh}`)).catch(() => undefined)
    await this.ensureIndex(fresh, true)
    for (let start = 0; start < documents.length; start += 1000) {
      const batch = documents.slice(start, start + 1000).map(toStored)
      await this.task(this.request('POST', `/indexes/${fresh}/documents`, batch))
    }
    await this.task(this.request('POST', '/swap-indexes', [{ indexes: [live, fresh] }]))
    await this.task(this.request('DELETE', `/indexes/${fresh}`))
  }

  async ping(): Promise<boolean> {
    try {
      const health = await this.request<{ status: string }>('GET', '/health')
      return health.status === 'available'
    } catch {
      return false
    }
  }

  private facets(
    main: SearchResponse,
    byGroup: Map<Group, SearchResponse | undefined>
  ): SearchFacets {
    const brands =
      byGroup.get('brand')?.facetDistribution?.brandFacet ?? main.facetDistribution?.brandFacet
    const options = new Map<string, Record<string, number>>()
    const collect = (distribution: Record<string, number> | undefined, only?: string) => {
      for (const [pair, count] of Object.entries(distribution ?? {})) {
        const name = pair.slice(0, pair.indexOf(':'))
        if (only !== undefined && name !== only) continue
        if (only === undefined && byGroup.has(`option:${name}`)) continue
        const values = options.get(name) ?? {}
        values[pair.slice(pair.indexOf(':') + 1)] = count
        options.set(name, values)
      }
    }
    collect(main.facetDistribution?.options)
    for (const [group, response] of byGroup) {
      if (group.startsWith('option:')) collect(response?.facetDistribution?.options, group.slice(7))
    }
    const price = main.facetStats?.priceFrom

    return {
      brands: labelled(brands),
      categories: labelled(main.facetDistribution?.categoryFacet),
      options: [...options.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'fa'))
        .map(([name, values]) => ({
          name,
          values: Object.entries(values)
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => b.count - a.count),
        })),
      price: price ? { min: price.min, max: price.max } : null,
    }
  }

  /** Creates the index with its settings the first time it is needed. */
  private async ensureIndex(uid: string, force = false): Promise<void> {
    if (uid === this.options.index && this.configured && !force) return
    await this.task(this.request('POST', '/indexes', { uid, primaryKey: 'id' })).catch(
      () => undefined
    )
    await this.task(
      this.request('PATCH', `/indexes/${uid}/settings`, {
        searchableAttributes: ['title_n', 'title_j', 'other_n'],
        filterableAttributes: ['id', 'categoryIds', 'brandId', 'options', 'priceFrom', 'inStock'],
        sortableAttributes: [
          'createdAt',
          'priceFrom',
          'salesCount',
          'ratingAverage',
          'ratingCount',
        ],
        // Relevance first, then popularity breaks ties between equally good matches.
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
          'salesCount:desc',
        ],
        faceting: { maxValuesPerFacet: 200 },
        pagination: { maxTotalHits: 10_000 },
        typoTolerance: { minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
      })
    )
    if (uid === this.options.index) this.configured = true
  }

  /** Waits for an asynchronous Meilisearch task and fails if it failed. */
  private async task(pending: Promise<unknown>): Promise<void> {
    const enqueued = (await pending) as { taskUid?: number } | null
    if (enqueued?.taskUid === undefined) return
    const deadline = Date.now() + (this.options.taskTimeoutMs ?? 30_000)
    for (let delay = 25; ; delay = Math.min(delay * 2, 500)) {
      const task = await this.request<{ status: string; error?: { message: string } }>(
        'GET',
        `/tasks/${enqueued.taskUid}`
      )
      if (task.status === 'succeeded') return
      if (task.status === 'failed' || task.status === 'canceled') {
        throw new Error(
          `Meilisearch task ${enqueued.taskUid} ${task.status}: ${task.error?.message ?? ''}`
        )
      }
      if (Date.now() > deadline) throw new Error(`Meilisearch task ${enqueued.taskUid} timed out`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.options.apiKey) headers.authorization = `Bearer ${this.options.apiKey}`
    const response = await this.fetcher(`${this.options.url.replace(/\/$/, '')}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text()
      this.logger.warn(`Meilisearch ${method} ${path} → ${response.status}: ${text.slice(0, 300)}`)
      throw new Error(`Meilisearch ${method} ${path} failed with ${response.status}`)
    }
    return (response.status === 204 ? null : await response.json()) as T
  }
}
