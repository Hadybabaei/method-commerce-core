import { Controller, Get, HttpStatus, Param } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  GetBrandBySlugUseCase,
  ListBrandsUseCase,
} from '../../application/use-cases/list-brands.use-case'
import { BrandResponse } from '../dto/catalog.response'

@ApiTags('Catalog')
@Controller('brands')
export class BrandsController {
  constructor(
    private readonly listBrandsUseCase: ListBrandsUseCase,
    private readonly getBrandBySlugUseCase: GetBrandBySlugUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all brands', description: 'Ordered by title.' })
  @ApiOkResponse({ type: [BrandResponse], description: 'Every brand.' })
  list() {
    return this.listBrandsUseCase.execute()
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get one brand by slug' })
  @ApiParam({ name: 'slug', example: 'bosch' })
  @ApiOkResponse({ type: BrandResponse, description: 'The brand.' })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  get(@Param('slug') slug: string) {
    return this.getBrandBySlugUseCase.execute(slug)
  }
}
