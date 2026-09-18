import { Inject, Injectable } from '@nestjs/common'
import { NoInputUseCase, UseCase } from '@shared/application/use-case'
import { ProvinceNotFoundError } from '../../domain/errors/addressing.errors'
import {
  LOCATION_REPOSITORY,
  LocationRepository,
} from '../../domain/repositories/location.repository'
import { CityView, ProvinceView } from '../dto/views'

@Injectable()
export class ListProvincesUseCase implements NoInputUseCase<ProvinceView[]> {
  constructor(@Inject(LOCATION_REPOSITORY) private readonly locations: LocationRepository) {}

  async execute(): Promise<ProvinceView[]> {
    const provinces = await this.locations.findProvinces()

    return provinces.map((province) => ({
      id: province.id,
      name: province.name,
      slug: province.slug,
      telPrefix: province.telPrefix,
    }))
  }
}

@Injectable()
export class ListCitiesUseCase implements UseCase<number, CityView[]> {
  constructor(@Inject(LOCATION_REPOSITORY) private readonly locations: LocationRepository) {}

  async execute(provinceId: number): Promise<CityView[]> {
    if (!(await this.locations.findProvinceById(provinceId))) {
      throw new ProvinceNotFoundError(provinceId)
    }

    const cities = await this.locations.findCitiesByProvinceId(provinceId)

    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      provinceId: city.provinceId,
    }))
  }
}
