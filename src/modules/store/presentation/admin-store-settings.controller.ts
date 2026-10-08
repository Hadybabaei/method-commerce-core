import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import { Body, Controller, Get, HttpStatus, Put, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  GetStoreSettingsUseCase,
  UpdateStoreSettingsUseCase,
} from '../application/store-settings.use-cases'
import { MAX_VAT_RATE_BP, SellerDetails, StoreSettings } from '../domain/store-settings'

class SellerDetailsRequest {
  @ApiPropertyOptional({ nullable: true, example: 'شرکت متد تجارت' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  legal_name?: string | null

  @ApiPropertyOptional({ nullable: true, example: '411111111111', description: 'کد اقتصادی' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{0,20}$/)
  economic_code?: string | null

  @ApiPropertyOptional({ nullable: true, example: '10101010101', description: 'شناسه ملی' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{0,20}$/)
  national_id?: string | null

  @ApiPropertyOptional({ nullable: true, example: '123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  registration_no?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null

  @ApiPropertyOptional({ nullable: true, example: '1234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{10})?$/)
  postal_code?: string | null

  @ApiPropertyOptional({ nullable: true, example: '02112345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null
}

class UpdateStoreSettingsRequest {
  @ApiPropertyOptional({ example: 1000, description: 'VAT in basis points: 1000 = 10%.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_VAT_RATE_BP)
  vat_rate_bp?: number

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  return_window_days?: number

  @ApiPropertyOptional({ type: SellerDetailsRequest })
  @IsOptional()
  @ValidateNested()
  @Type(() => SellerDetailsRequest)
  seller?: SellerDetailsRequest
}

class SellerDetailsResponse implements SellerDetails {
  @ApiProperty({ nullable: true }) legalName: string | null
  @ApiProperty({ nullable: true }) economicCode: string | null
  @ApiProperty({ nullable: true }) nationalId: string | null
  @ApiProperty({ nullable: true }) registrationNo: string | null
  @ApiProperty({ nullable: true }) address: string | null
  @ApiProperty({ nullable: true }) postalCode: string | null
  @ApiProperty({ nullable: true }) phone: string | null
}

class StoreSettingsResponse implements StoreSettings {
  @ApiProperty({ example: 1000, description: 'Basis points: 1000 = 10%.' })
  vatRateBp: number

  @ApiProperty({ example: 7 })
  returnWindowDays: number

  @ApiProperty({ type: SellerDetailsResponse })
  seller: SellerDetailsResponse
}

@ApiTags('Admin settings')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('settings')
@Controller('admin/settings')
export class AdminStoreSettingsController {
  constructor(
    private readonly getStoreSettingsUseCase: GetStoreSettingsUseCase,
    private readonly updateStoreSettingsUseCase: UpdateStoreSettingsUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'Store settings: VAT rate, return window and seller details' })
  @ApiOkResponse({ type: StoreSettingsResponse })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  get() {
    return this.getStoreSettingsUseCase.execute()
  }

  @Put()
  @ApiOperation({
    summary: 'Update store settings',
    description:
      'Only sent fields change. A new VAT rate applies to orders placed afterwards; existing orders keep theirs.',
  })
  @ApiOkResponse({ type: StoreSettingsResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  update(@Body() body: UpdateStoreSettingsRequest) {
    const seller = body.seller
    return this.updateStoreSettingsUseCase.execute({
      vatRateBp: body.vat_rate_bp,
      returnWindowDays: body.return_window_days,
      seller: seller && {
        legalName: seller.legal_name,
        economicCode: seller.economic_code,
        nationalId: seller.national_id,
        registrationNo: seller.registration_no,
        address: seller.address,
        postalCode: seller.postal_code,
        phone: seller.phone,
      },
    })
  }
}
