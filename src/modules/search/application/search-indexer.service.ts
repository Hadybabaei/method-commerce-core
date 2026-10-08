import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { SearchConfig } from '@config/search.config'
import { CATALOG_CHANGED, CatalogChange } from '@modules/catalog/domain/events/catalog-changed'
import {
  PRODUCT_DOCUMENT_SOURCE,
  ProductDocumentSource,
  SEARCH_ENGINE,
  SearchEngine,
} from './search.ports'

const DEBOUNCE_MS = 500

/**
 * Keeps the search index in step with the catalog: changed products are
 * re-indexed shortly after the change (coalesced), and the whole index is
 * rebuilt on start-up and periodically for changes no event reports.
 * Indexing never fails a request; errors are logged and the next refresh heals.
 */
@Injectable()
export class SearchIndexerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexerService.name)
  private pending = new Set<number>()
  private rebuildPending = false
  private timer: NodeJS.Timeout | null = null
  private refresh: NodeJS.Timeout | null = null
  /** Serialises index writes so a rebuild and an update never interleave. */
  private chain: Promise<void> = Promise.resolve()

  constructor(
    @Inject(SEARCH_ENGINE) private readonly engine: SearchEngine,
    @Inject(PRODUCT_DOCUMENT_SOURCE) private readonly source: ProductDocumentSource,
    private readonly configService: ConfigService
  ) {}

  onApplicationBootstrap(): void {
    const config = this.configService.getOrThrow<SearchConfig>('search')
    if (config.reindexOnBoot || config.driver === 'memory') this.scheduleRebuild()
    if (config.refreshMinutes > 0) {
      this.refresh = setInterval(() => this.scheduleRebuild(), config.refreshMinutes * 60_000)
      this.refresh.unref()
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.refresh) clearInterval(this.refresh)
  }

  @OnEvent(CATALOG_CHANGED)
  async onCatalogChanged(change: CatalogChange): Promise<void> {
    if (change.everything) {
      this.scheduleRebuild()
      return
    }
    const fromVariants = await this.source.productIdsForVariants(change.variantIds).catch(() => [])
    this.schedule([...change.productIds, ...fromVariants])
  }

  @OnEvent('catalog.product.published')
  @OnEvent('catalog.product.unpublished')
  @OnEvent('comments.published')
  @OnEvent('comments.unpublished')
  @OnEvent('comments.deleted')
  onProductEvent(event: { payload: { productId: number } }): void {
    this.schedule([event.payload.productId])
  }

  /** Re-indexes these products soon; several changes in a burst become one write. */
  schedule(productIds: number[]): void {
    for (const id of productIds) this.pending.add(id)
    this.arm()
  }

  scheduleRebuild(): void {
    this.rebuildPending = true
    this.arm()
  }

  /** Rebuilds now and resolves when done; for the admin endpoint. */
  async rebuildNow(): Promise<number> {
    let count = 0
    await this.enqueue(async () => {
      const documents = await this.source.all()
      await this.engine.replaceAll(documents)
      count = documents.length
    })
    return count
  }

  /** Waits for queued work; for tests. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
      this.run()
    }
    await this.chain
  }

  private arm(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.run()
    }, DEBOUNCE_MS)
    this.timer.unref()
  }

  private run(): void {
    if (this.rebuildPending) {
      this.rebuildPending = false
      this.pending.clear()
      void this.enqueue(async () => {
        const documents = await this.source.all()
        await this.engine.replaceAll(documents)
        this.logger.log(`Search index rebuilt with ${documents.length} products`)
      })
      return
    }
    const ids = [...this.pending]
    this.pending.clear()
    if (ids.length === 0) return
    void this.enqueue(async () => {
      const documents = await this.source.byIds(ids)
      const found = new Set(documents.map((document) => document.id))
      await this.engine.upsert(documents)
      await this.engine.remove(ids.filter((id) => !found.has(id)))
    })
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(work).catch((error: unknown) => {
      this.logger.warn(
        `Search indexing failed: ${error instanceof Error ? error.message : String(error)}`
      )
    })
    return this.chain
  }
}
