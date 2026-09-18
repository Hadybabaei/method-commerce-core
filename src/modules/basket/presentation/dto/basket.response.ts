import { ApiProperty } from '@nestjs/swagger'
import { BasketLineIssue, BasketLineView, BasketView } from '../../application/dto/views'

export class BasketProductRefResponse {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'دریل شارژی بوش' })
  title: string

  @ApiProperty({ example: 'دریل-شارژی-بوش' })
  slug: string

  @ApiProperty({ nullable: true })
  thumbnail: string | null
}

export class BasketVariantRefResponse {
  @ApiProperty({ example: 'DRL-RED-L' })
  sku: string

  @ApiProperty({
    example: [{ option: 'رنگ', value: 'قرمز' }],
    type: 'array',
    items: {
      type: 'object',
      properties: {
        option: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  options: { option: string; value: string }[]

  @ApiProperty({ nullable: true })
  image: string | null

  @ApiProperty({ example: true })
  isActive: boolean
}

export class BasketLineResponse implements BasketLineView {
  @ApiProperty({ example: 11 })
  variantId: number

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiProperty({ example: 2_400_000, description: 'Unit price in Rial.' })
  unitPrice: number

  @ApiProperty({ example: 4_800_000 })
  lineTotal: number

  @ApiProperty({ example: 8 })
  availableQuantity: number

  @ApiProperty({ type: BasketProductRefResponse })
  product: BasketProductRefResponse

  @ApiProperty({ type: BasketVariantRefResponse })
  variant: BasketVariantRefResponse

  @ApiProperty({
    example: [],
    enum: ['UNPUBLISHED', 'INACTIVE', 'OUT_OF_STOCK', 'INSUFFICIENT_STOCK'],
    isArray: true,
    description: 'Blocking issues for checkout. Empty when the line is fine.',
  })
  issues: BasketLineIssue[]
}

export class BasketResponse implements BasketView {
  @ApiProperty({ example: 3 })
  id: number

  @ApiProperty({ example: 2, description: 'Number of distinct lines.' })
  itemCount: number

  @ApiProperty({ example: 5, description: 'Sum of quantities across lines.' })
  totalQuantity: number

  @ApiProperty({
    example: 7_200_000,
    description: 'Sum of line totals for lines with no issues, in Rial.',
  })
  subtotal: number

  @ApiProperty({ type: [BasketLineResponse] })
  items: BasketLineResponse[]
}
