import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface GeoPointProps {
  latitude: number
  longitude: number
}

/** Map pin for an address. Latitude and longitude are only valid as a pair. */
export class GeoPoint extends ValueObject<GeoPointProps> {
  private constructor(props: GeoPointProps) {
    super(props)
  }

  static create(latitude: number, longitude: number): GeoPoint {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new InvalidInputError('Latitude must be between -90 and 90')
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new InvalidInputError('Longitude must be between -180 and 180')
    }

    return new GeoPoint({ latitude, longitude })
  }

  /** Returns `null` unless both coordinates are present. */
  static createOptional(
    latitude: number | null | undefined,
    longitude: number | null | undefined
  ): GeoPoint | null {
    if (latitude === null || latitude === undefined) return null
    if (longitude === null || longitude === undefined) return null

    return GeoPoint.create(latitude, longitude)
  }

  get latitude(): number {
    return this.props.latitude
  }

  get longitude(): number {
    return this.props.longitude
  }
}
