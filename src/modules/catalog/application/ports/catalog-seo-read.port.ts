export type CatalogEntryType = 'product' | 'category' | 'brand'
export const CATALOG_ENTRY_TYPES: readonly CatalogEntryType[] = ['product', 'category', 'brand']

export interface SitemapEntry {
  slug: string
  updatedAt: Date
}

export interface SitemapView {
  /** Published products only. */
  products: SitemapEntry[]
  categories: SitemapEntry[]
  brands: SitemapEntry[]
}

export interface CatalogSeoReadModel {
  /**
   * Current slug for an entry that used to live at `slug`, or null when the
   * slug never redirected or the entry is gone (or, for products, unpublished).
   */
  resolveRedirect(type: CatalogEntryType, slug: string): Promise<string | null>

  sitemap(): Promise<SitemapView>
}

export const CATALOG_SEO_READ_MODEL = Symbol('CatalogSeoReadModel')
