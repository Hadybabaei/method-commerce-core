import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { CategoryNotEmptyError, CategoryNotFoundError } from '../../domain/errors/catalog.errors'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'

@Injectable()
export class DeleteCategoryUseCase implements UseCase<number, void> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(categoryId: number): Promise<void> {
    const category = await this.categories.findById(categoryId)

    if (!category) {
      throw new CategoryNotFoundError(categoryId)
    }

    // Deleting a branch of the tree, or orphaning products, is never what the
    // caller meant; they have to empty it first.
    const [childCount, productCount] = await Promise.all([
      this.categories.countChildren(categoryId),
      this.categories.countProducts(categoryId),
    ])

    if (childCount > 0 || productCount > 0) {
      throw new CategoryNotEmptyError(childCount, productCount)
    }

    await this.categories.delete(categoryId)
  }
}
