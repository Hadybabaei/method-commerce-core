import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { AppConfig } from '@config/app.config'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { HandlePaymentCallbackUseCase } from '../../application/use-cases/handle-payment-callback.use-case'
import { PaymentCallbackQuery } from '../dto/payment.request'
import { PaymentCallbackResponse } from '../dto/payment.response'

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly frontendUrl: string

  constructor(
    private readonly handlePaymentCallbackUseCase: HandlePaymentCallbackUseCase,
    configService: ConfigService
  ) {
    this.frontendUrl = configService.getOrThrow<AppConfig>('app').frontendUrl.replace(/\/$/, '')
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Zibal payment callback',
    description:
      'Zibal redirects the browser here after checkout. The server verifies the trackId with Zibal, then redirects the customer to the frontend order page. Replays are idempotent.',
  })
  @ApiOkResponse({ type: PaymentCallbackResponse })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async callback(@Query() query: PaymentCallbackQuery, @Res() res: Response): Promise<void> {
    const result = await this.handlePaymentCallbackUseCase.execute({
      raw: {
        trackId: query.trackId,
        success: query.success,
        status: query.status,
        orderId: query.orderId,
      },
    })

    const paid = result.payment.status === 'SUCCEEDED'
    const target = `${this.frontendUrl}/orders/${result.order.id}?payment=${paid ? 'success' : 'failed'}`
    res.redirect(HttpStatus.FOUND, target)
  }
}
