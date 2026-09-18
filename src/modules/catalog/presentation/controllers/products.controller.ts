import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { GetProductBySlugUseCase } from '../../application/use-cases/get-product.use-case'
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case'
import { ListProductsRequest } from '../dto/product-query.request'
import { ProductDetailResponse, ProductSummaryResponse } from '../dto/catalog.response'

/** Storefront side of the catalog: published products only. */
@ApiTags('Catalog')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductBySlugUseCase: GetProductBySlugUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List published products',
    description:
      'Filter by product id, title, category (with sub-tree), brand, price range and available quantity. Sort by newest, oldest, title, or price (cheapest active variant). Price and quantity filters omit products that have no active variant.',
  })
  @ApiPaginatedResponse(ProductSummaryResponse, 'A page of product cards.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  list(@Query() query: ListProductsRequest) {
    return this.listProductsUseCase.execute({
      productId: query.product_id,
      categoryId: query.category_id,
      categorySlug: query.category_slug,
      brandId: query.brand_id,
      brandSlug: query.brand_slug,
      title: query.title,
      search: query.search,
      priceMin: query.price_min,
      priceMax: query.price_max,
      quantityMin: query.quantity_min,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      publishedOnly: true,
    })
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get one published product with its options and variants',
    description: 'Unpublished products return 404 here, as if they did not exist.',
  })
  @ApiParam({
    name: 'slug',
    example: 'دریل-شارژی-بوش',
    description: 'Percent-encode Persian slugs.',
  })
  @ApiOkResponse({ type: ProductDetailResponse, description: 'The full product page payload.' })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  get(@Param('slug') slug: string) {
    return this.getProductBySlugUseCase.execute({ slug, publishedOnly: true })
  }
}
