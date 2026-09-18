import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Category, CategoryChanges, PathRewrite } from '../../domain/entities/category.aggregate'
import { CategoryNotFoundError, SlugAlreadyTakenError } from '../../domain/errors/catalog.errors'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { Slug } from '../../domain/value-objects/slug.vo'
import { UpdateCategoryCommand } from '../dto/commands'
import { CategoryView } from '../dto/views'
import { toCategoryView } from '../mappers/catalog-view.mapper'

@Injectable()
export class UpdateCategoryUseCase implements UseCase<UpdateCategoryCommand, CategoryView> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(command: UpdateCategoryCommand): Promise<CategoryView> {
    const category = await this.categories.findById(command.categoryId)

    if (!category) {
      throw new CategoryNotFoundError(command.categoryId)
    }

    category.apply(await this.toChanges(command, category))

    const pathRewrite = await this.reparent(command, category)

    return toCategoryView(await this.categories.save(category, pathRewrite))
  }

  private async toChanges(
    command: UpdateCategoryCommand,
    category: Category
  ): Promise<CategoryChanges> {
    const changes: CategoryChanges = {}

    if (command.title !== undefined) changes.title = command.title
    if (command.icon !== undefined) changes.icon = command.icon
    if (command.description !== undefined) changes.description = command.description
    if (command.position !== undefined) changes.position = command.position

    if (command.slug !== undefined) {
      const slug = Slug.create(command.slug)

      if (await this.categories.existsBySlug(slug.value, category.id)) {
        throw new SlugAlreadyTakenError(slug.value)
      }

      changes.slug = slug
    }

    return changes
  }

  /**
   * Moving a category drags its whole subtree along, so the deepest node
   * decides whether the move stays inside the depth limit.
   */
  private async reparent(
    command: UpdateCategoryCommand,
    category: Category
  ): Promise<PathRewrite | null> {
    if (command.parentId === undefined) {
      return null
    }

    const parent =
      command.parentId === null ? null : await this.categories.findById(command.parentId)

    if (command.parentId !== null && !parent) {
      throw new CategoryNotFoundError(command.parentId)
    }

    const deepest = await this.categories.findDeepestDescendantDepth(category)

    return category.moveTo(parent, deepest)
  }
}
