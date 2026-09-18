import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Brand } from '../../domain/entities/brand.aggregate'
import { SlugAlreadyTakenError } from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'
import { Slug } from '../../domain/value-objects/slug.vo'
import { CreateBrandCommand } from '../dto/commands'
import { BrandView } from '../dto/views'
import { toBrandView } from '../mappers/catalog-view.mapper'

@Injectable()
export class CreateBrandUseCase implements UseCase<CreateBrandCommand, BrandView> {
  constructor(@Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository) {}

  async execute(command: CreateBrandCommand): Promise<BrandView> {
    const slug = Slug.create(command.slug ?? command.title)

    if (await this.brands.existsBySlug(slug.value)) {
      throw new SlugAlreadyTakenError(slug.value)
    }

    const brand = Brand.create({
      title: command.title,
      slug,
      logo: command.logo ?? null,
      description: command.description ?? null,
    })

    return toBrandView(await this.brands.save(brand))
  }
}
