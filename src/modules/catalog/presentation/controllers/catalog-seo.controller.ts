import { Controller, Get, HttpStatus, Param, ParseEnumPipe } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  CATALOG_ENTRY_TYPES,
  CatalogEntryType,
  SitemapEntry,
  SitemapView,
} from '../../application/ports/catalog-seo-read.port'
import {
  GetSitemapUseCase,
  ResolveSlugRedirectUseCase,
  SlugRedirectView,
} from '../../application/use-cases/catalog-seo.use-cases'

const ENTRY_TYPE_ENUM = Object.fromEntries(CATALOG_ENTRY_TYPES.map((type) => [type, type]))

class SlugRedirectResponse implements SlugRedirectView {
  @ApiProperty({ enum: CATALOG_ENTRY_TYPES, example: 'product' })
  type: CatalogEntryType

  @ApiProperty({ example: 'دریل-شارژی-بوش-gsr' })
  slug: string
}

class SitemapEntryResponse implements SitemapEntry {
  @ApiProperty({ example: 'دریل-شارژی' })
  slug: string

  @ApiProperty()
  updatedAt: Date
}

class SitemapResponse implements SitemapView {
  @ApiProperty({
    type: [SitemapEntryResponse],
    description: 'Published products, newest change first.',
  })
  products: SitemapEntryResponse[]

  @ApiProperty({ type: [SitemapEntryResponse] })
  categories: SitemapEntryResponse[]

  @ApiProperty({ type: [SitemapEntryResponse] })
  brands: SitemapEntryResponse[]
}

@ApiTags('Catalog')
@Controller()
export class CatalogSeoController {
  constructor(
    private readonly resolveSlugRedirectUseCase: ResolveSlugRedirectUseCase,
    private readonly getSitemapUseCase: GetSitemapUseCase
  ) {}

  @Get('slug-redirects/:type/:slug')
  @ApiOperation({
    summary: 'Find where an old catalog slug moved',
    description:
      'Call after a 404 on a product, category or brand slug. Answer with a permanent (301/308) redirect to the returned slug.',
  })
  @ApiParam({ name: 'type', enum: CATALOG_ENTRY_TYPES })
  @ApiParam({ name: 'slug', description: 'Percent-encode Persian slugs.' })
  @ApiOkResponse({ type: SlugRedirectResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  resolve(
    @Param('type', new ParseEnumPipe(ENTRY_TYPE_ENUM)) type: CatalogEntryType,
    @Param('slug') slug: string
  ) {
    return this.resolveSlugRedirectUseCase.execute({ type, slug })
  }

  @Get('sitemap')
  @ApiOperation({
    summary: 'Every public catalog URL for sitemap.xml',
    description: 'Slugs and last-modified dates for published products, categories and brands.',
  })
  @ApiOkResponse({ type: SitemapResponse })
  sitemap() {
    return this.getSitemapUseCase.execute()
  }
}
