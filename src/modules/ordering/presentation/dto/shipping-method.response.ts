import { ApiProperty } from '@nestjs/swagger'
import { ShippingMethodView, ShippingOptionView } from '../../application/dto/views'

export class ShippingMethodResponse implements ShippingMethodView {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'پست پیشتاز' })
  name: string

  @ApiProperty({ example: 'post' })
  code: string

  @ApiProperty({ nullable: true })
  description: string | null

  @ApiProperty({ example: 500_000, description: 'Rial.' })
  baseFee: number

  @ApiProperty({ example: 150_000, description: 'Rial per started kilogram.' })
  perKgFee: number

  @ApiProperty({ nullable: true, example: 50_000_000 })
  freeAbove: number | null

  @ApiProperty({ nullable: true, example: 2 })
  minDays: number | null

  @ApiProperty({ nullable: true, example: 5 })
  maxDays: number | null

  @ApiProperty({ nullable: true, type: [Number], description: 'Null = every province.' })
  provinceIds: number[] | null

  @ApiProperty({ nullable: true, example: 'https://tracking.post.ir/?id={code}' })
  trackingUrlTemplate: string | null

  @ApiProperty({ example: true })
  isActive: boolean

  @ApiProperty({ example: 0 })
  position: number
}

export class ShippingOptionResponse implements ShippingOptionView {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'پست پیشتاز' })
  name: string

  @ApiProperty({ example: 'post' })
  code: string

  @ApiProperty({ nullable: true })
  description: string | null

  @ApiProperty({ example: 650_000, description: 'Fee for this basket and address, in Rial.' })
  fee: number

  @ApiProperty({ nullable: true, example: 2 })
  minDays: number | null

  @ApiProperty({ nullable: true, example: 5 })
  maxDays: number | null
}
