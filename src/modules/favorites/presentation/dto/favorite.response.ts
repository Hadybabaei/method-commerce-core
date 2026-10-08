import { ApiProperty } from '@nestjs/swagger'
import {
  ProductSummaryResponse,
  ProductVariantResponse,
} from '@modules/catalog/presentation/dto/catalog.response'
import { FavoriteView } from '../../application/dto/views'

export class FavoriteResponse implements FavoriteView {
  @ApiProperty({ example: 7 })
  id: number

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  favoritedAt: Date

  @ApiProperty({ type: ProductSummaryResponse })
  product: ProductSummaryResponse

  @ApiProperty({
    type: ProductVariantResponse,
    nullable: true,
    description: 'The saved variant; null = the product in general.',
  })
  variant: ProductVariantResponse | null
}
