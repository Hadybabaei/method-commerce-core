import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { CategoryNotFoundError } from '../../domain/errors/catalog.errors'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { CategoryView } from '../dto/views'
import { toCategoryView } from '../mappers/catalog-view.mapper'

@Injectable()
export class GetCategoryBySlugUseCase implements UseCase<string, CategoryView> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(slug: string): Promise<CategoryView> {
    const category = await this.categories.findBySlug(slug)

    if (!category) {
      throw new CategoryNotFoundError(slug)
    }

    return toCategoryView(category)
  }
}
