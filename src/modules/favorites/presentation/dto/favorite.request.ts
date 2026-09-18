import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class AddFavoriteRequest {
  @ApiProperty({ example: 1, description: 'Id of the product to save.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number
}
