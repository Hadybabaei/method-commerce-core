import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { AddProductVariantUseCase } from '../../application/use-cases/add-product-variant.use-case'
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case'
import { DeleteProductUseCase } from '../../application/use-cases/delete-product.use-case'
import { DeleteProductVariantUseCase } from '../../application/use-cases/delete-product-variant.use-case'
import { GetProductByIdUseCase } from '../../application/use-cases/get-product.use-case'
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case'
import { ReplaceProductOptionsUseCase } from '../../application/use-cases/replace-product-options.use-case'
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case'
import { UpdateProductVariantUseCase } from '../../application/use-cases/update-product-variant.use-case'
import { ListProductsRequest } from '../dto/product-query.request'
import {
  CreateProductRequest,
  CreateProductVariantRequest,
  ReplaceProductOptionsRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
} from '../dto/product.request'
import { ProductDetailResponse, ProductSummaryResponse } from '../dto/catalog.response'

/** Panel side of the catalog: drafts are visible here and nowhere else. */
@ApiTags('Admin catalog')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly replaceProductOptionsUseCase: ReplaceProductOptionsUseCase,
    private readonly addProductVariantUseCase: AddProductVariantUseCase,
    private readonly updateProductVariantUseCase: UpdateProductVariantUseCase,
    private readonly deleteProductVariantUseCase: DeleteProductVariantUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List products, drafts included',
    description: 'Same filters as the storefront list, without the published-only restriction.',
  })
  @ApiPaginatedResponse(ProductSummaryResponse, 'A page of products, drafts included.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
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
      publishedOnly: false,
    })
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one product by id',
    description: 'The panel uses ids because a draft slug may still change.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({
    type: ProductDetailResponse,
    description: 'The product with everything inside it.',
  })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIntPipe) productId: number) {
    return this.getProductByIdUseCase.execute(productId)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Created as a draft unless published is true. The first image becomes the thumbnail unless one is marked.',
  })
  @ApiCreatedResponse({ type: ProductDetailResponse, description: 'The product was created.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  create(@Body() body: CreateProductRequest) {
    return this.createProductUseCase.execute({
      title: body.title,
      slug: body.slug,
      subTitle: body.sub_title,
      description: body.description,
      shortDescription: body.short_description,
      published: body.published,
      weightGrams: body.weight_grams,
      categoryId: body.category_id,
      brandId: body.brand_id,
      images: body.images,
    })
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Only the fields present in the body are changed, except images: sending that key replaces the whole list.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: ProductDetailResponse, description: 'The updated product.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  update(@Param('id', ParseIntPipe) productId: number, @Body() body: UpdateProductRequest) {
    return this.updateProductUseCase.execute({
      productId,
      title: body.title,
      slug: body.slug,
      subTitle: body.sub_title,
      description: body.description,
      shortDescription: body.short_description,
      published: body.published,
      weightGrams: body.weight_grams,
      categoryId: body.category_id,
      brandId: body.brand_id,
      images: body.images,
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product with its images, options and variants',
    description: 'Cascades to everything inside the product.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiNoContentResponse({ description: 'The product was deleted.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  async remove(@Param('id', ParseIntPipe) productId: number): Promise<void> {
    await this.deleteProductUseCase.execute(productId)
  }

  @Put(':id/options')
  @ApiOperation({
    summary: 'Replace the option axes of a product',
    description:
      'Only allowed before the first variant exists. After that, option names and values are locked.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: ProductDetailResponse, description: 'The product with its options.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  replaceOptions(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: ReplaceProductOptionsRequest
  ) {
    return this.replaceProductOptionsUseCase.execute({
      productId,
      options: body.options,
    })
  }

  @Post(':id/variants')
  @ApiOperation({
    summary: 'Add a sellable SKU',
    description:
      'Omit options (or send []) when the product has no option axes. on_hand is stored on the default warehouse.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiCreatedResponse({ type: ProductDetailResponse, description: 'The product with the new variant.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  addVariant(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: CreateProductVariantRequest
  ) {
    return this.addProductVariantUseCase.execute({
      productId,
      sku: body.sku,
      price: body.price,
      salePrice: body.sale_price,
      weightGrams: body.weight_grams,
      image: body.image,
      isActive: body.is_active,
      options: body.options,
      onHand: body.on_hand,
    })
  }

  @Patch(':id/variants/:variantId')
  @ApiOperation({
    summary: 'Update a variant',
    description: 'Price, SKU, image, weight, active flag and on_hand. Option picks cannot change.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: ProductDetailResponse, description: 'The product with the updated variant.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  updateVariant(
    @Param('id', ParseIntPipe) productId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: UpdateProductVariantRequest
  ) {
    return this.updateProductVariantUseCase.execute({
      productId,
      variantId,
      sku: body.sku,
      price: body.price,
      salePrice: body.sale_price,
      weightGrams: body.weight_grams,
      image: body.image,
      isActive: body.is_active,
      onHand: body.on_hand,
    })
  }

  @Delete(':id/variants/:variantId')
  @ApiOperation({
    summary: 'Delete a variant',
    description: 'Order lines keep their snapshot; open basket lines for this SKU are removed.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: ProductDetailResponse, description: 'The product without that variant.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  deleteVariant(
    @Param('id', ParseIntPipe) productId: number,
    @Param('variantId', ParseIntPipe) variantId: number
  ) {
    return this.deleteProductVariantUseCase.execute({ productId, variantId })
  }
}
