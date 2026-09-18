import { City, Province } from '../entities/location'

export interface LocationRepository {
  findProvinces(): Promise<Province[]>

  findProvinceById(id: number): Promise<Province | null>

  findCitiesByProvinceId(provinceId: number): Promise<City[]>

  findCityById(id: number): Promise<City | null>
}

export const LOCATION_REPOSITORY = Symbol('LocationRepository')
