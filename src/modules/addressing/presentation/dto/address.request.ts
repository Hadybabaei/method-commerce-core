import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

export class CreateAddressRequest {
  @ApiProperty({ example: 'خانه' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  city_id: number

  @ApiPropertyOptional({
    example: 8,
    description: 'Optional. When sent it must match the province the city belongs to.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  province_id?: number

  @ApiProperty({ example: 'سعادت آباد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  hood: string

  @ApiProperty({ example: '1998745632', description: '10 digits' })
  @IsString()
  @IsNotEmpty()
  postalCode: string

  @ApiProperty({ example: '24', description: 'Street number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  pelak: string

  @ApiPropertyOptional({ example: '3', description: 'Unit number', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vahed?: string | null

  @ApiProperty({ example: 'خیابان نهم، پلاک ۲۴، واحد ۳' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  details: string

  @ApiProperty({
    example: true,
    description: 'True when the account holder receives the order in person',
  })
  @IsBoolean()
  ownReceiver: boolean

  @ApiPropertyOptional({ description: 'Required when ownReceiver is false' })
  @ValidateIf((request: CreateAddressRequest) => request.ownReceiver === false)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  receiverFullName?: string

  @ApiPropertyOptional({
    example: '09121234567',
    description: 'Required when ownReceiver is false',
  })
  @ValidateIf((request: CreateAddressRequest) => request.ownReceiver === false)
  @IsString()
  @IsNotEmpty()
  receiverPhoneNumber?: string

  @ApiPropertyOptional({ example: 35.759, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number | null

  @ApiPropertyOptional({ example: 51.401, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  long?: number | null
}

/** Same fields as create, all optional; omitted keys are left unchanged. */
export class UpdateAddressRequest extends PartialType(CreateAddressRequest) {}
