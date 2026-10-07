import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { CATALOG_UPLOAD_FOLDERS } from '../../application/use-cases/upload-catalog-image.use-case'

export class UploadCatalogImageQuery {
  @ApiProperty({
    enum: CATALOG_UPLOAD_FOLDERS,
    example: 'products',
    required: false,
    description: 'Subfolder under uploads/. Defaults to products.',
  })
  @IsOptional()
  @IsString()
  @IsIn([...CATALOG_UPLOAD_FOLDERS])
  folder?: string
}

export class UploadedImageResponse {
  @ApiProperty({ example: 'http://localhost:4000/uploads/products/1710000000-abc.jpg' })
  url: string
}
