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
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { CreateBrandUseCase } from '../../application/use-cases/create-brand.use-case'
import { DeleteBrandUseCase } from '../../application/use-cases/delete-brand.use-case'
import { ListBrandsUseCase } from '../../application/use-cases/list-brands.use-case'
import { UpdateBrandUseCase } from '../../application/use-cases/update-brand.use-case'
import { CreateBrandRequest, UpdateBrandRequest } from '../dto/brand.request'
import { BrandResponse } from '../dto/catalog.response'

@ApiTags('Admin catalog')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(
    private readonly createBrandUseCase: CreateBrandUseCase,
    private readonly updateBrandUseCase: UpdateBrandUseCase,
    private readonly deleteBrandUseCase: DeleteBrandUseCase,
    private readonly listBrandsUseCase: ListBrandsUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all brands' })
  @ApiOkResponse({ type: [BrandResponse], description: 'Every brand.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list() {
    return this.listBrandsUseCase.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Create a brand',
    description: 'The slug is derived from the title when not given.',
  })
  @ApiCreatedResponse({ type: BrandResponse, description: 'The brand was created.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.CONFLICT)
  create(@Body() body: CreateBrandRequest) {
    return this.createBrandUseCase.execute({
      title: body.title,
      slug: body.slug,
      logo: body.logo,
      description: body.description,
    })
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a brand',
    description: 'Only the fields present in the body are changed.',
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: BrandResponse, description: 'The updated brand.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  update(@Param('id', ParseIntPipe) brandId: number, @Body() body: UpdateBrandRequest) {
    return this.updateBrandUseCase.execute({
      brandId,
      title: body.title,
      slug: body.slug,
      logo: body.logo,
      description: body.description,
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a brand that has no products',
    description: 'Refused while any product still points at it.',
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiNoContentResponse({ description: 'The brand was deleted.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async remove(@Param('id', ParseIntPipe) brandId: number): Promise<void> {
    await this.deleteBrandUseCase.execute(brandId)
  }
}
