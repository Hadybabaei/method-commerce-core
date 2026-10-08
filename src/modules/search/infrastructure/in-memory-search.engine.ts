import {
  FacetCount,
  ProductDocument,
  ProductSearchQuery,
  ProductSearchResult,
  SearchEngine,
  SearchFacets,
} from '../application/search.ports'
import { joinHalfSpaces, normalizePersian, tokenize } from '../domain/persian-text'

interface Indexed {
  document: ProductDocument
  /** Normalised words of the title, then of everything else searchable. */
  titleWords: string[]
  otherWords: string[]
}

type Group = 'brand' | 'category' | `option:${string}` | 'none'

const optionName = (pair: string) => pair.slice(0, pair.indexOf(':'))
const optionValue = (pair: string) => pair.slice(pair.indexOf(':') + 1)

function words(...texts: (string | null | undefined)[]): string[] {
  const all = texts.flatMap((text) => [
    ...tokenize(text ?? ''),
    ...joinHalfSpaces(text).split(/[^\p{L}\p{N}]+/u),
  ])
  return [...new Set(all.filter(Boolean))]
}

/**
 * Searches documents held in memory. Used when no Meilisearch server is
 * configured (development, tests, very small stores): matching is by word
 * prefix after Persian normalisation, without typo tolerance.
 */
export class InMemorySearchEngine implements SearchEngine {
  private indexed = new Map<number, Indexed>()

  async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
    const tokens = query.q ? tokenize(query.q) : []
    const scored: { entry: Indexed; score: number }[] = []
    for (const entry of this.indexed.values()) {
      const score = InMemorySearchEngine.score(entry, tokens)
      if (score > 0) scored.push({ entry, score })
    }

    const matching = scored.filter(({ entry }) => this.passes(entry.document, query))
    const sorted = InMemorySearchEngine.sort(matching, query)

    return {
      items: sorted
        .slice(query.offset, query.offset + query.limit)
        .map(({ entry }) => entry.document),
      total: sorted.length,
      limit: query.limit,
      offset: query.offset,
      facets: this.facets(
        scored.map(({ entry }) => entry.document),
        query
      ),
    }
  }

  async upsert(documents: ProductDocument[]): Promise<void> {
    for (const document of documents) {
      this.indexed.set(document.id, {
        document,
        titleWords: words(document.title),
        otherWords: words(
          document.subTitle,
          document.brand?.title,
          document.category?.title,
          ...document.options.map(optionValue)
        ),
      })
    }
  }

  async remove(ids: number[]): Promise<void> {
    for (const id of ids) this.indexed.delete(id)
  }

  async replaceAll(documents: ProductDocument[]): Promise<void> {
    this.indexed = new Map()
    await this.upsert(documents)
  }

  async ping(): Promise<boolean> {
    return true
  }

  /** 0 = no match. Every query word must start a word of the product; title hits weigh more. */
  private static score(entry: Indexed, tokens: string[]): number {
    if (tokens.length === 0) return 1
    let score = 0
    for (const token of tokens) {
      if (entry.titleWords.some((word) => word === token)) score += 4
      else if (entry.titleWords.some((word) => word.startsWith(token))) score += 3
      else if (entry.otherWords.some((word) => word.startsWith(token))) score += 1
      else return 0
    }
    return score
  }

  /** Every filter of the query, optionally ignoring one facet group (for its own counts). */
  private passes(document: ProductDocument, query: ProductSearchQuery, ignore?: Group): boolean {
    if (query.onlyIds && !query.onlyIds.includes(document.id)) return false
    if (query.excludeIds?.includes(document.id)) return false
    if (ignore !== 'category' && query.categoryId !== undefined) {
      if (!document.categoryIds.includes(query.categoryId)) return false
    }
    if (ignore !== 'brand' && query.brandIds?.length) {
      if (!document.brand || !query.brandIds.includes(document.brand.id)) return false
    }
    for (const [name, values] of Object.entries(query.options ?? {})) {
      if (ignore === `option:${name}` || values.length === 0) continue
      if (!values.some((value) => document.options.includes(`${name}:${value}`))) return false
    }
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      if (document.priceFrom === null) return false
      if (query.priceMin !== undefined && document.priceFrom < query.priceMin) return false
      if (query.priceMax !== undefined && document.priceFrom > query.priceMax) return false
    }
    if (query.inStockOnly && !document.inStock) return false
    return true
  }

  private static sort(
    rows: { entry: Indexed; score: number }[],
    query: ProductSearchQuery
  ): { entry: Indexed; score: number }[] {
    const by =
      (pick: (document: ProductDocument) => number, direction: 1 | -1) =>
      (a: { entry: Indexed }, b: { entry: Indexed }) =>
        direction * (pick(a.entry.document) - pick(b.entry.document))
    const newest = by((document) => document.createdAt, -1)
    const compare = {
      relevance: (a: { entry: Indexed; score: number }, b: { entry: Indexed; score: number }) =>
        b.score - a.score ||
        b.entry.document.salesCount - a.entry.document.salesCount ||
        newest(a, b),
      newest,
      price_asc: by((document) => document.priceFrom ?? Number.MAX_SAFE_INTEGER, 1),
      price_desc: by((document) => document.priceFrom ?? -1, -1),
      best_selling: by((document) => document.salesCount, -1),
      rating: by((document) => document.ratingAverage * 1000 + document.ratingCount, -1),
    }[query.sort]
    return [...rows].sort((a, b) => compare(a, b) || b.entry.document.id - a.entry.document.id)
  }

  /**
   * Disjunctive facets: each group is counted with every filter except its
   * own, so picking one brand still shows how many products the others have.
   */
  private facets(candidates: ProductDocument[], query: ProductSearchQuery): SearchFacets {
    const count = <TKey>(
      ignore: Group,
      keys: (document: ProductDocument) => { value: TKey; label: string }[]
    ): FacetCount<TKey>[] => {
      const counts = new Map<TKey, FacetCount<TKey>>()
      for (const document of candidates) {
        if (!this.passes(document, query, ignore)) continue
        for (const key of keys(document)) {
          const current = counts.get(key.value) ?? { ...key, count: 0 }
          current.count += 1
          counts.set(key.value, current)
        }
      }
      return [...counts.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa')
      )
    }

    const names = new Set(candidates.flatMap((document) => document.options.map(optionName)))
    for (const name of Object.keys(query.options ?? {})) names.add(name)

    const matching = candidates.filter((document) => this.passes(document, query))
    const prices = matching
      .map((document) => document.priceFrom)
      .filter((price): price is number => price !== null)

    return {
      brands: count('brand', (document) =>
        document.brand ? [{ value: document.brand.id, label: document.brand.title }] : []
      ),
      // Categories narrow (a tree to walk down), so their counts keep the category filter.
      categories: count('none', (document) =>
        document.category ? [{ value: document.category.id, label: document.category.title }] : []
      ),
      options: [...names]
        .sort((a, b) => a.localeCompare(b, 'fa'))
        .map((name) => ({
          name,
          values: count(`option:${name}`, (document) =>
            [...new Set(document.options.filter((pair) => optionName(pair) === name))].map(
              (pair) => ({
                value: optionValue(pair),
                label: optionValue(pair),
              })
            )
          ),
        }))
        .filter((group) => group.values.length > 0),
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    }
  }
}

/** Exposed for the Meilisearch adapter, which indexes the same searchable text. */
export const searchableText = {
  title: (document: ProductDocument) => normalizePersian(document.title),
  titleJoined: (document: ProductDocument) => joinHalfSpaces(document.title),
  other: (document: ProductDocument) =>
    normalizePersian(
      [
        document.subTitle,
        document.brand?.title,
        document.category?.title,
        ...document.options.map(optionValue),
      ]
        .filter(Boolean)
        .join(' ')
    ),
}
