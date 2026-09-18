import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Category } from '../../domain/entities/category.aggregate'
import { CategoryNotFoundError, SlugAlreadyTakenError } from '../../domain/errors/catalog.errors'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { Slug } from '../../domain/value-objects/slug.vo'
import { CreateCategoryCommand } from '../dto/commands'
import { CategoryView } from '../dto/views'
import { toCategoryView } from '../mappers/catalog-view.mapper'

@Injectable()
export class CreateCategoryUseCase implements UseCase<CreateCategoryCommand, CategoryView> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(command: CreateCategoryCommand): Promise<CategoryView> {
    const slug = Slug.create(command.slug ?? command.title)

    if (await this.categories.existsBySlug(slug.value)) {
      throw new SlugAlreadyTakenError(slug.value)
    }

    const parent = await this.resolveParent(command.parentId)

    const category = Category.create({
      title: command.title,
      slug,
      icon: command.icon ?? null,
      description: command.description ?? null,
      position: command.position ?? 0,
      parent,
    })

    return toCategoryView(await this.categories.save(category))
  }

  private async resolveParent(parentId?: number | null): Promise<Category | null> {
    if (parentId === undefined || parentId === null) {
      return null
    }

    const parent = await this.categories.findById(parentId)

    if (!parent) {
      throw new CategoryNotFoundError(parentId)
    }

    return parent
  }
}
