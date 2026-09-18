import { Inject, Injectable } from '@nestjs/common'
import { NoInputUseCase, UseCase } from '@shared/application/use-case'
import { BrandNotFoundError } from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'
import { BrandView } from '../dto/views'
import { toBrandView } from '../mappers/catalog-view.mapper'

@Injectable()
export class ListBrandsUseCase implements NoInputUseCase<BrandView[]> {
  constructor(@Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository) {}

  async execute(): Promise<BrandView[]> {
    const brands = await this.brands.findAll()

    return brands.map(toBrandView)
  }
}

@Injectable()
export class GetBrandBySlugUseCase implements UseCase<string, BrandView> {
  constructor(@Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository) {}

  async execute(slug: string): Promise<BrandView> {
    const brand = await this.brands.findBySlug(slug)

    if (!brand) {
      throw new BrandNotFoundError(slug)
    }

    return toBrandView(brand)
  }
}
