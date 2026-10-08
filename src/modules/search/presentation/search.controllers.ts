import { CachedRead } from '@shared/presentation/interceptors/cached-read.interceptor'
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { SearchIndexerService } from '../application/search-indexer.service'
import {
  RecommendationsUseCase,
  SearchProductsUseCase,
  SuggestUseCase,
} from '../application/search.use-cases'
import {
  RecommendationsRequest,
  SearchHitResponse,
  SearchRequest,
  SearchResponse,
  SuggestionsResponse,
  SuggestRequest,
} from './search.dto'

@ApiTags('Search')
@Controller()
export class SearchController {
  constructor(
    private readonly searchProducts: SearchProductsUseCase,
    private readonly suggest: SuggestUseCase,
    private readonly recommendations: RecommendationsUseCase
  ) {}

  @Get('search')
  @CachedRead('catalog', 60)
  @ApiOperation({
    summary: 'Search published products with facets',
    description:
      'Persian spelling variants (ي/ی, ك/ک, half-spaces, digits) match each other. Facets count brands and option values as if that group were not filtered, so the other choices stay visible.',
  })
  @ApiOkResponse({ type: SearchResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  search(@Query() query: SearchRequest) {
    return this.searchProducts.execute({
      q: query.q,
      categoryId: query.category_id,
      categorySlug: query.category_slug,
      brandIds: query.brand_ids,
      brandSlugs: query.brand_slugs,
      options: query.options,
      priceMin: query.price_min,
      priceMax: query.price_max,
      inStockOnly: query.in_stock,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Get('search/suggest')
  @CachedRead('catalog', 60)
  @ApiOperation({
    summary: 'Type-ahead: up to 6 products and 3 categories',
    description: 'Empty under 2 characters.',
  })
  @ApiOkResponse({ type: SuggestionsResponse })
  suggestions(@Query() query: SuggestRequest) {
    return this.suggest.execute(query.q)
  }

  @Get('products/:slug/related')
  @CachedRead('catalog', 60)
  @ApiOperation({ summary: 'In-stock best sellers from the same category, then the same brand' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ type: [SearchHitResponse] })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  related(@Param('slug') slug: string, @Query() query: RecommendationsRequest) {
    return this.recommendations.related(slug, query.limit ?? 8)
  }

  @Get('products/:slug/bought-together')
  @CachedRead('catalog', 60)
  @ApiOperation({ summary: 'In-stock products most often bought in the same order' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ type: [SearchHitResponse] })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  boughtTogether(@Param('slug') slug: string, @Query() query: RecommendationsRequest) {
    return this.recommendations.boughtTogether(slug, query.limit ?? 4)
  }
}

@ApiTags('Admin search')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('catalog')
@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly indexer: SearchIndexerService) {}

  @Post('reindex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rebuild the product search index now',
    description: 'Searches keep working on the old index until the new one is ready.',
  })
  @ApiOkResponse({ schema: { properties: { indexed: { type: 'number' } } } })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async reindex() {
    return { indexed: await this.indexer.rebuildNow() }
  }
}
