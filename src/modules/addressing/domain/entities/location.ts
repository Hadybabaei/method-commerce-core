/**
 * Provinces and cities are reference data maintained outside this service, so
 * the addressing context treats them as read-only lookups rather than
 * aggregates it can change.
 */
export interface Province {
  id: number
  name: string
  slug: string
  telPrefix: string
}

export interface City {
  id: number
  name: string
  slug: string
  provinceId: number
}
