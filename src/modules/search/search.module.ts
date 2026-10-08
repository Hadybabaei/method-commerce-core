import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SearchConfig } from '@config/search.config'
import { IdentityModule } from '@modules/identity/identity.module'
import { SearchIndexerService } from './application/search-indexer.service'
import {
  BOUGHT_TOGETHER_READ_MODEL,
  PRODUCT_DOCUMENT_SOURCE,
  SEARCH_ENGINE,
  SearchEngine,
} from './application/search.ports'
import {
  CATALOG_LOOKUP,
  RecommendationsUseCase,
  SearchProductsUseCase,
  SuggestUseCase,
} from './application/search.use-cases'
import { InMemorySearchEngine } from './infrastructure/in-memory-search.engine'
import { MeilisearchEngine } from './infrastructure/meilisearch.engine'
import { PrismaCatalogLookup } from './infrastructure/prisma-catalog.lookup'
import { PrismaProductDocumentSource } from './infrastructure/prisma-product-document.source'
import { AdminSearchController, SearchController } from './presentation/search.controllers'

/**
 * Storefront search, facets, suggestions and recommendations over an index
 * kept in step with the catalog. Meilisearch when MEILISEARCH_URL is set,
 * otherwise an in-memory index.
 */
@Module({
  imports: [IdentityModule],
  controllers: [SearchController, AdminSearchController],
  providers: [
    {
      provide: SEARCH_ENGINE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SearchEngine => {
        const config = configService.getOrThrow<SearchConfig>('search')
        return config.driver === 'meilisearch'
          ? new MeilisearchEngine(config.meilisearch)
          : new InMemorySearchEngine()
      },
    },
    PrismaProductDocumentSource,
    { provide: PRODUCT_DOCUMENT_SOURCE, useExisting: PrismaProductDocumentSource },
    { provide: BOUGHT_TOGETHER_READ_MODEL, useExisting: PrismaProductDocumentSource },
    { provide: CATALOG_LOOKUP, useClass: PrismaCatalogLookup },
    SearchIndexerService,
    SearchProductsUseCase,
    SuggestUseCase,
    RecommendationsUseCase,
  ],
  exports: [SEARCH_ENGINE],
})
export class SearchModule {}
