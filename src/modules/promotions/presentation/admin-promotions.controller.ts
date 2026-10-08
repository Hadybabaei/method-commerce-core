import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'
import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  CreatePromotionUseCase,
  DeletePromotionUseCase,
  ListPromotionsUseCase,
  PromotionView,
  UpdatePromotionUseCase,
} from '../application/promotion.use-cases'
import { PROMOTION_KINDS, PromotionInput, PromotionKind } from '../domain/promotion.entity'

class CreatePromotionRequest {
  @ApiProperty({ example: 'تخفیف پاییزه' })
  @IsString()
  @MaxLength(191)
  name: string

  @ApiPropertyOptional({
    nullable: true,
    example: 'AUTUMN10',
    description: 'Coupon code. Omit or null for an automatic campaign.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string | null

  @ApiProperty({ enum: PROMOTION_KINDS })
  @IsEnum(PromotionKind)
  kind: PromotionKind

  @ApiPropertyOptional({ example: 10, description: 'PERCENT: 1–100. FIXED: Rial.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  value?: number

  @ApiPropertyOptional({ nullable: true, description: 'Cap for PERCENT, Rial.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_discount?: number | null

  @ApiPropertyOptional({ nullable: true, description: 'Eligible subtotal needed, Rial.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_subtotal?: number | null

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  starts_at: Date

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  ends_at?: Date | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  per_customer_limit?: number | null

  @ApiPropertyOptional({
    nullable: true,
    type: [Number],
    description: 'Categories (with sub-categories) in scope; null = everything.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  category_ids?: number[] | null

  @ApiPropertyOptional({ nullable: true, type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  brand_ids?: number[] | null

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}

class UpdatePromotionRequest extends PartialType(CreatePromotionRequest) {}

class PromotionResponse implements PromotionView {
  @ApiProperty() id: number
  @ApiProperty() name: string
  @ApiProperty({ nullable: true }) code: string | null
  @ApiProperty({ enum: PROMOTION_KINDS }) kind: PromotionKind
  @ApiProperty() value: number
  @ApiProperty({ nullable: true }) maxDiscount: number | null
  @ApiProperty({ nullable: true }) minSubtotal: number | null
  @ApiProperty() startsAt: Date
  @ApiProperty({ nullable: true }) endsAt: Date | null
  @ApiProperty({ nullable: true }) usageLimit: number | null
  @ApiProperty({ nullable: true }) perCustomerLimit: number | null
  @ApiProperty({ nullable: true, type: [Number] }) categoryIds: number[] | null
  @ApiProperty({ nullable: true, type: [Number] }) brandIds: number[] | null
  @ApiProperty() isActive: boolean
  @ApiProperty({ description: 'Orders currently using it (cancelled orders release it).' })
  usedCount: number
}

function toInput(body: UpdatePromotionRequest): Partial<PromotionInput> {
  return {
    name: body.name,
    code: body.code,
    kind: body.kind,
    value: body.value,
    maxDiscount: body.max_discount,
    minSubtotal: body.min_subtotal,
    startsAt: body.starts_at,
    endsAt: body.ends_at,
    usageLimit: body.usage_limit,
    perCustomerLimit: body.per_customer_limit,
    categoryIds: body.category_ids,
    brandIds: body.brand_ids,
    isActive: body.is_active,
  }
}

@ApiTags('Admin promotions')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('promotions')
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(
    private readonly listPromotionsUseCase: ListPromotionsUseCase,
    private readonly createPromotionUseCase: CreatePromotionUseCase,
    private readonly updatePromotionUseCase: UpdatePromotionUseCase,
    private readonly deletePromotionUseCase: DeletePromotionUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'Coupons and automatic campaigns, newest first, with usage counts' })
  @ApiOkResponse({ type: [PromotionResponse] })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list() {
    return this.listPromotionsUseCase.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Create a coupon or campaign',
    description:
      'An order gets at most one promotion: the coupon or the best campaign, whichever saves more. VAT is charged after the discount.',
  })
  @ApiCreatedResponse({ type: PromotionResponse })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT
  )
  create(@Body() body: CreatePromotionRequest) {
    const input = toInput(body)
    return this.createPromotionUseCase.execute({
      ...input,
      name: body.name,
      kind: body.kind,
      value: body.value ?? 0,
      maxDiscount: body.max_discount ?? null,
      minSubtotal: body.min_subtotal ?? null,
      startsAt: body.starts_at,
      endsAt: body.ends_at ?? null,
      usageLimit: body.usage_limit ?? null,
      perCustomerLimit: body.per_customer_limit ?? null,
      categoryIds: body.category_ids ?? null,
      brandIds: body.brand_ids ?? null,
    })
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promotion', description: 'Only sent fields change.' })
  @ApiOkResponse({ type: PromotionResponse })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdatePromotionRequest) {
    return this.updatePromotionUseCase.execute({ id, ...toInput(body) })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an unused promotion',
    description: 'Used ones: set is_active=false.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deletePromotionUseCase.execute({ id })
  }
}
