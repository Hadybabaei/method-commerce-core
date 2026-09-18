import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BrandChanges } from '../../domain/entities/brand.aggregate'
import { BrandNotFoundError, SlugAlreadyTakenError } from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'
import { Slug } from '../../domain/value-objects/slug.vo'
import { UpdateBrandCommand } from '../dto/commands'
import { BrandView } from '../dto/views'
import { toBrandView } from '../mappers/catalog-view.mapper'

@Injectable()
export class UpdateBrandUseCase implements UseCase<UpdateBrandCommand, BrandView> {
  constructor(@Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository) {}

  async execute(command: UpdateBrandCommand): Promise<BrandView> {
    const brand = await this.brands.findById(command.brandId)

    if (!brand) {
      throw new BrandNotFoundError(command.brandId)
    }

    const changes: BrandChanges = {}

    if (command.title !== undefined) changes.title = command.title
    if (command.logo !== undefined) changes.logo = command.logo
    if (command.description !== undefined) changes.description = command.description

    if (command.slug !== undefined) {
      const slug = Slug.create(command.slug)

      if (await this.brands.existsBySlug(slug.value, brand.id)) {
        throw new SlugAlreadyTakenError(slug.value)
      }

      changes.slug = slug
    }

    brand.apply(changes)

    return toBrandView(await this.brands.save(brand))
  }
}
