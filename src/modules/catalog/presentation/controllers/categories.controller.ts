import { Controller, Get, HttpStatus, Param } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { GetCategoryBySlugUseCase } from '../../application/use-cases/get-category.use-case'
import { ListCategoryTreeUseCase } from '../../application/use-cases/list-categories.use-case'
import { CategoryResponse, CategoryTreeResponse } from '../dto/catalog.response'

@ApiTags('Catalog')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly listCategoryTreeUseCase: ListCategoryTreeUseCase,
    private readonly getCategoryBySlugUseCase: GetCategoryBySlugUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The whole category tree, nested',
    description: 'One query regardless of depth; categories nest up to five levels.',
  })
  @ApiOkResponse({ type: [CategoryTreeResponse], description: 'Root categories with children.' })
  list() {
    return this.listCategoryTreeUseCase.execute()
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get one category by slug' })
  @ApiParam({ name: 'slug', example: 'ابزار-برقی', description: 'Percent-encode Persian slugs.' })
  @ApiOkResponse({ type: CategoryResponse, description: 'The category, without its children.' })
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  get(@Param('slug') slug: string) {
    return this.getCategoryBySlugUseCase.execute(slug)
  }
}
