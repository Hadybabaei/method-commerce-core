import { CityNotFoundError, CityProvinceMismatchError } from '../errors/addressing.errors'
import { LocationRepository } from '../repositories/location.repository'

/**
 * Domain service: an address is only valid if its city exists and actually sits
 * in the province it claims. The rule needs a lookup, so it cannot live inside
 * the aggregate, but it is still domain logic rather than orchestration.
 *
 * When no province is submitted the city's own province is used, which is why
 * this returns the pair to store.
 */
export async function resolveVerifiedLocation(
  locations: LocationRepository,
  cityId: number,
  provinceId?: number | null
): Promise<{ cityId: number; provinceId: number }> {
  const city = await locations.findCityById(cityId)

  if (!city) {
    throw new CityNotFoundError(cityId)
  }

  if (provinceId !== undefined && provinceId !== null && city.provinceId !== provinceId) {
    throw new CityProvinceMismatchError()
  }

  return { cityId: city.id, provinceId: city.provinceId }
}
