import { ForbiddenError, InvalidInputError, NotFoundError } from '@shared/domain/errors'

export class AddressNotFoundError extends NotFoundError {
  constructor(id?: number) {
    super('Address not found', id === undefined ? undefined : { id })
  }
}

export class AddressNotOwnedError extends ForbiddenError {
  constructor() {
    super('This address belongs to another account')
  }
}

export class CityNotFoundError extends NotFoundError {
  constructor(cityId?: number) {
    super('City not found', cityId === undefined ? undefined : { cityId })
  }
}

export class ProvinceNotFoundError extends NotFoundError {
  constructor(provinceId?: number) {
    super('Province not found', provinceId === undefined ? undefined : { provinceId })
  }
}

/** The city exists but sits in a different province than the one submitted. */
export class CityProvinceMismatchError extends InvalidInputError {
  constructor() {
    super('The selected city does not belong to the selected province')
  }
}
