import { ApiProperty } from '@nestjs/swagger'
import { AddressView, CityView, ProvinceView } from '../../application/dto/views'

export class ProvinceResponse implements ProvinceView {
  @ApiProperty({ example: 8 })
  id: number

  @ApiProperty({ example: 'تهران' })
  name: string

  @ApiProperty({ example: 'tehran' })
  slug: string

  @ApiProperty({ example: '021' })
  telPrefix: string
}

export class CityResponse implements CityView {
  @ApiProperty({ example: 12 })
  id: number

  @ApiProperty({ example: 'شهریار' })
  name: string

  @ApiProperty({ example: 'tehran-2' })
  slug: string

  @ApiProperty({ example: 8 })
  provinceId: number
}

export class ReceiverResponse {
  @ApiProperty({
    example: true,
    description: 'True when the account holder takes delivery in person.',
  })
  isAccountOwner: boolean

  @ApiProperty({ example: 'مریم رضایی', nullable: true })
  fullName: string | null

  @ApiProperty({ example: '09129998877', nullable: true })
  phoneNumber: string | null
}

export class GeoPointResponse {
  @ApiProperty({ example: 35.759 })
  latitude: number

  @ApiProperty({ example: 51.401 })
  longitude: number
}

export class AddressResponse implements AddressView {
  @ApiProperty({ example: 3 })
  id: number

  @ApiProperty({ example: 'خانه' })
  title: string

  @ApiProperty({ type: ProvinceResponse })
  province: ProvinceResponse

  @ApiProperty({ type: CityResponse })
  city: CityResponse

  @ApiProperty({ example: 'سعادت آباد' })
  hood: string

  @ApiProperty({ example: '1998745632' })
  postalCode: string

  @ApiProperty({ example: '24', description: 'Street number.' })
  pelak: string

  @ApiProperty({ example: '3', nullable: true, description: 'Unit number.' })
  vahed: string | null

  @ApiProperty({ example: 'خیابان نهم، پلاک ۲۴، واحد ۳' })
  details: string

  @ApiProperty({ type: ReceiverResponse })
  receiver: ReceiverResponse

  @ApiProperty({ type: GeoPointResponse, nullable: true })
  location: GeoPointResponse | null
}
