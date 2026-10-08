import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { AppConfig } from '@config/app.config'
import { RESPONSE_CACHE, ResponseCache } from '@shared/application/ports/response-cache.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { CATALOG_CHANGED, CatalogChange } from '../domain/events/catalog-changed'

const DEBOUNCE_MS = 1000

/**
 * After the catalog changes: drops cached public reads at once, and asks the
 * storefront (debounced) to revalidate its cached catalog pages. A storefront
 * that cannot be reached is logged and otherwise ignored; its timers still
 * refresh the pages.
 */
@Injectable()
export class CatalogFreshnessListener implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogFreshnessListener.name)
  private slugs = new Set<string>()
  private everything = false
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(RESPONSE_CACHE) private readonly cache: ResponseCache,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  /** Replaceable in tests. */
  fetcher: typeof fetch = (input, init) => fetch(input, init)

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer)
  }

  @OnEvent(CATALOG_CHANGED)
  async onCatalogChanged(change: CatalogChange): Promise<void> {
    await this.cache.bump('catalog')
    if (!this.revalidation()) return
    if (change.everything) {
      this.everything = true
    } else {
      const products = await this.prisma.product.findMany({
        where: {
          OR: [
            { id: { in: change.productIds } },
            { variants: { some: { id: { in: change.variantIds } } } },
          ],
        },
        select: { slug: true },
      })
      for (const product of products) this.slugs.add(product.slug)
    }
    this.arm()
  }

  @OnEvent('comments.published')
  @OnEvent('comments.unpublished')
  @OnEvent('comments.deleted')
  async onRatingChanged(): Promise<void> {
    await this.cache.bump('catalog')
  }

  /** Sends what is queued now; for tests and shutdown. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    await this.send()
  }

  private revalidation() {
    const app = this.configService.getOrThrow<AppConfig>('app')
    return app.storefrontRevalidateUrl && app.storefrontRevalidateSecret
      ? { url: app.storefrontRevalidateUrl, secret: app.storefrontRevalidateSecret }
      : null
  }

  private arm(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.send()
    }, DEBOUNCE_MS)
    this.timer.unref()
  }

  private async send(): Promise<void> {
    const target = this.revalidation()
    if (!target || (!this.everything && this.slugs.size === 0)) return
    const body = { tags: ['catalog'], productSlugs: this.everything ? [] : [...this.slugs] }
    this.slugs.clear()
    this.everything = false
    try {
      const response = await this.fetcher(target.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': target.secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) this.logger.warn(`Storefront revalidation answered ${response.status}`)
    } catch (error) {
      this.logger.warn(
        `Storefront revalidation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
