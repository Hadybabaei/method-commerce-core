import { Controller, Get, HttpStatus, Logger, Query, Res } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { AppConfig } from '@config/app.config'
import {
  HandlePaymentCallbackUseCase,
  PaymentCallbackState,
} from '../../application/use-cases/handle-payment-callback.use-case'
import { PaymentCallbackQuery } from '../dto/payment.request'
import { PaymentCallbackResponse } from '../dto/payment.response'

const CALLBACK_QUERY_VALUE: Record<PaymentCallbackState, string> = {
  paid: 'success',
  failed: 'failed',
  'refund-required': 'refund-pending',
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)
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
      'Zibal redirects the browser here after checkout. The server verifies the trackId with Zibal, then redirects the customer to the frontend order page. Replays are idempotent. Failures redirect with payment=failed instead of returning 4xx to the browser. A capture we cannot fulfill (stock sold meanwhile) redirects with payment=refund-pending.',
  })
  @ApiOkResponse({ type: PaymentCallbackResponse })
  async callback(@Query() query: PaymentCallbackQuery, @Res() res: Response): Promise<void> {
    try {
      const result = await this.handlePaymentCallbackUseCase.execute({
        raw: {
          trackId: query.trackId,
          success: query.success,
          status: query.status,
          orderId: query.orderId,
        },
      })

      const target = `${this.frontendUrl}/orders/${result.order.id}?payment=${CALLBACK_QUERY_VALUE[result.state]}`
      res.redirect(HttpStatus.FOUND, target)
    } catch (error) {
      this.logger.warn(
        `Payment callback failed for trackId=${query.trackId ?? 'missing'}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      res.redirect(HttpStatus.FOUND, `${this.frontendUrl}/orders?payment=failed`)
    }
  }
}
