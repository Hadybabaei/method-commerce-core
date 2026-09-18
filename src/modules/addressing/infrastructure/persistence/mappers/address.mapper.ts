import { Prisma, user_address as AddressRecord } from '@prisma/client'
import { Address } from '../../../domain/entities/address.aggregate'
import { GeoPoint } from '../../../domain/value-objects/geo-point.vo'
import { PostalCode } from '../../../domain/value-objects/postal-code.vo'
import { Receiver } from '../../../domain/value-objects/receiver.vo'
import { AddressView } from '../../../application/dto/views'

export type { AddressRecord }
export type AddressWithLocationRecord = Prisma.user_addressGetPayload<{
  include: { province: true; city: true }
}>

export function toDomainAddress(record: AddressRecord): Address {
  return Address.fromPersistence(record.id, {
    userId: record.userId,
    title: record.title,
    provinceId: record.province_id,
    cityId: record.city_id,
    hood: record.hood,
    postalCode: PostalCode.fromPersistence(record.postalCode),
    pelak: record.pelak,
    vahed: record.vahed,
    details: record.details,
    receiver: Receiver.fromPersistence({
      isAccountOwner: record.ownReceiver,
      fullName: record.receiverFullName,
      phoneNumber: record.receiverPhoneNumber,
    }),
    location: GeoPoint.createOptional(record.lat, record.long),
  })
}

export function toAddressWriteData(address: Address) {
  return {
    title: address.title,
    userId: address.userId,
    province_id: address.provinceId,
    city_id: address.cityId,
    hood: address.hood,
    postalCode: address.postalCode.value,
    pelak: address.pelak,
    vahed: address.vahed,
    details: address.details,
    ownReceiver: address.receiver.isAccountOwner,
    receiverFullName: address.receiver.fullName,
    receiverPhoneNumber: address.receiver.phoneNumber,
    lat: address.location?.latitude ?? null,
    long: address.location?.longitude ?? null,
  }
}

/** Read-side projection: province and city names joined in for the client. */
export function toAddressView(record: AddressWithLocationRecord): AddressView {
  return {
    id: record.id,
    title: record.title,
    province: {
      id: record.province.id,
      name: record.province.name,
      slug: record.province.slug,
      telPrefix: record.province.tel_prefix,
    },
    city: {
      id: record.city.id,
      name: record.city.name,
      slug: record.city.slug,
      provinceId: record.city.province_id,
    },
    hood: record.hood,
    postalCode: record.postalCode,
    pelak: record.pelak,
    vahed: record.vahed,
    details: record.details,
    receiver: {
      isAccountOwner: record.ownReceiver,
      fullName: record.receiverFullName,
      phoneNumber: record.receiverPhoneNumber,
    },
    location:
      record.lat !== null && record.long !== null
        ? { latitude: record.lat, longitude: record.long }
        : null,
  }
}
