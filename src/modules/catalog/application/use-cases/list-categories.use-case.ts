import { Inject, Injectable } from '@nestjs/common'
import { NoInputUseCase } from '@shared/application/use-case'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { CategoryTreeView } from '../dto/views'
import { buildCategoryTree } from '../mappers/catalog-view.mapper'

@Injectable()
export class ListCategoryTreeUseCase implements NoInputUseCase<CategoryTreeView[]> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(): Promise<CategoryTreeView[]> {
    return buildCategoryTree(await this.categories.findAll())
  }
}
