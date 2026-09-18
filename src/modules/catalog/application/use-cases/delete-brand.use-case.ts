import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BrandInUseError, BrandNotFoundError } from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'

@Injectable()
export class DeleteBrandUseCase implements UseCase<number, void> {
  constructor(@Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository) {}

  async execute(brandId: number): Promise<void> {
    const brand = await this.brands.findById(brandId)

    if (!brand) {
      throw new BrandNotFoundError(brandId)
    }

    const productCount = await this.brands.countProducts(brandId)

    if (productCount > 0) {
      throw new BrandInUseError(productCount)
    }

    await this.brands.delete(brandId)
  }
}
