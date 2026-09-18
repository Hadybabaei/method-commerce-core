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
import { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case'
import { DeleteCategoryUseCase } from '../../application/use-cases/delete-category.use-case'
import { ListCategoryTreeUseCase } from '../../application/use-cases/list-categories.use-case'
import { UpdateCategoryUseCase } from '../../application/use-cases/update-category.use-case'
import { CreateCategoryRequest, UpdateCategoryRequest } from '../dto/category.request'
import { CategoryResponse, CategoryTreeResponse } from '../dto/catalog.response'

@ApiTags('Admin catalog')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
    private readonly listCategoryTreeUseCase: ListCategoryTreeUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'The whole category tree, nested' })
  @ApiOkResponse({ type: [CategoryTreeResponse], description: 'Root categories with children.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list() {
    return this.listCategoryTreeUseCase.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Create a category',
    description:
      'Omit parent_id for a root category. The slug is derived from the title when not given, and Persian titles keep their letters.',
  })
  @ApiCreatedResponse({ type: CategoryResponse, description: 'The category was created.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  create(@Body() body: CreateCategoryRequest) {
    return this.createCategoryUseCase.execute({
      title: body.title,
      slug: body.slug,
      icon: body.icon,
      description: body.description,
      parentId: body.parent_id,
      position: body.position,
    })
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category, or move it and its subtree',
    description:
      'Sending parent_id moves the category with everything beneath it. A category cannot be moved inside its own subtree, and the move must stay within the depth limit.',
  })
  @ApiParam({ name: 'id', example: 4 })
  @ApiOkResponse({ type: CategoryResponse, description: 'The updated category.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  update(@Param('id', ParseIntPipe) categoryId: number, @Body() body: UpdateCategoryRequest) {
    return this.updateCategoryUseCase.execute({
      categoryId,
      title: body.title,
      slug: body.slug,
      icon: body.icon,
      description: body.description,
      parentId: body.parent_id,
      position: body.position,
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an empty category',
    description: 'Refused while the category still has children or products.',
  })
  @ApiParam({ name: 'id', example: 4 })
  @ApiNoContentResponse({ description: 'The category was deleted.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async remove(@Param('id', ParseIntPipe) categoryId: number): Promise<void> {
    await this.deleteCategoryUseCase.execute(categoryId)
  }
}
