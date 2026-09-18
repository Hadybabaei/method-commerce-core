export interface LocationView {
  id: number
  name: string
  slug: string
}

export interface ProvinceView extends LocationView {
  telPrefix: string
}

export interface CityView extends LocationView {
  provinceId: number
}

export interface AddressView {
  id: number
  title: string
  province: ProvinceView
  city: CityView
  hood: string
  postalCode: string
  pelak: string
  vahed: string | null
  details: string
  receiver: {
    isAccountOwner: boolean
    fullName: string | null
    phoneNumber: string | null
  }
  location: { latitude: number; longitude: number } | null
}
