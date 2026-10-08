import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
  ApiTags,
} from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { StockAlertsService, StockAlertView } from '../application/stock-alerts'

class SubscribeStockAlertRequest {
  @ApiProperty({ example: 12, description: 'An out-of-stock variant.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variant_id: number
}

class StockAlertOptionResponse {
  @ApiProperty({ example: 'رنگ' }) option: string
  @ApiProperty({ example: 'قرمز' }) value: string
}

class StockAlertResponse implements StockAlertView {
  @ApiProperty() variantId: number
  @ApiProperty() productId: number
  @ApiProperty() title: string
  @ApiProperty() slug: string
  @ApiProperty({ type: [StockAlertOptionResponse] }) options: StockAlertOptionResponse[]
  @ApiProperty() createdAt: Date
}

/** "Tell me when it is back": one SMS when the variant can be bought again. */
@ApiTags('Stock alerts')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/stock-alerts')
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Alerts still waiting, newest first' })
  @ApiOkResponse({ type: [StockAlertResponse] })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') userId: number) {
    return this.alerts.waiting(userId)
  }

  @Post()
  @ApiOperation({
    summary: 'Ask for an SMS when a variant is back in stock',
    description:
      'Idempotent; asking again after an alert was sent starts a new wait. 422 when the variant can already be bought.',
  })
  @ApiCreatedResponse({ type: [StockAlertResponse], description: 'The waiting alerts.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  subscribe(@CurrentActor('id') userId: number, @Body() body: SubscribeStockAlertRequest) {
    return this.alerts.subscribe(userId, body.variant_id)
  }

  @Delete(':variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop waiting for a variant' })
  @ApiNoContentResponse()
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  async unsubscribe(
    @CurrentActor('id') userId: number,
    @Param('variantId', ParseIntPipe) variantId: number
  ): Promise<void> {
    await this.alerts.unsubscribe(userId, variantId)
  }
}
