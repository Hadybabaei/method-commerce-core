export interface CreateAddressCommand {
  userId: number
  title: string
  cityId: number
  provinceId?: number | null
  hood: string
  postalCode: string
  pelak: string
  vahed?: string | null
  details: string
  ownReceiver: boolean
  receiverFullName?: string | null
  receiverPhoneNumber?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface UpdateAddressCommand {
  addressId: number
  userId: number
  title?: string
  cityId?: number
  provinceId?: number | null
  hood?: string
  postalCode?: string
  pelak?: string
  vahed?: string | null
  details?: string
  ownReceiver?: boolean
  receiverFullName?: string | null
  receiverPhoneNumber?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface AddressScopedCommand {
  addressId: number
  userId: number
}
