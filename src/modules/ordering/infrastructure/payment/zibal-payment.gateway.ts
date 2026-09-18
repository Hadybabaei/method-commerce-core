import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PaymentConfig } from '@config/payment.config'
import { PaymentGatewayError } from '../../domain/errors/ordering.errors'
import {
  CreateGatewayPaymentInput,
  CreateGatewayPaymentResult,
  ParsedGatewayCallback,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../../application/ports/payment-gateway.port'

/** Zibal IPG result code for a successful request/verify. */
const ZIBAL_OK = 100
/** Verify returned but the track was already verified earlier. */
const ZIBAL_ALREADY_VERIFIED = 201
/** Callback `status` when the user completed payment successfully. */
const ZIBAL_STATUS_PAID = 2

type ZibalRequestResponse = {
  result: number
  message?: string
  trackId?: number
}

type ZibalVerifyResponse = {
  result: number
  message?: string
  refNumber?: string | number | null
  amount?: number
  status?: number
  cardNumber?: string | null
}

/**
 * Zibal IPG adapter: request → redirect to /start/{trackId} → callback → verify.
 * @see https://help.zibal.ir/ipg
 */
@Injectable()
export class ZibalPaymentGateway implements PaymentGateway {
  readonly provider = 'zibal'
  private readonly logger = new Logger(ZibalPaymentGateway.name)
  private readonly merchant: string
  private readonly apiBaseUrl: string
  private readonly callbackUrl: string

  constructor(configService: ConfigService) {
    const payment = configService.getOrThrow<PaymentConfig>('payment')
    this.merchant = payment.zibal.merchant
    this.apiBaseUrl = payment.zibal.apiBaseUrl
    this.callbackUrl = payment.zibal.callbackUrl
  }

  async createPayment(input: CreateGatewayPaymentInput): Promise<CreateGatewayPaymentResult> {
    const body = {
      merchant: this.merchant,
      amount: input.amount,
      callbackUrl: this.callbackUrl,
      description: input.description ?? `Order ${input.merchantOrderId}`,
      orderId: input.merchantOrderId,
      ...(input.mobileNumber ? { mobile: input.mobileNumber } : {}),
    }

    const response = await this.postJson<ZibalRequestResponse>('/v1/request', body)

    if (response.result !== ZIBAL_OK || response.trackId === undefined) {
      throw new PaymentGatewayError('Zibal rejected the payment request', {
        provider: this.provider,
        result: response.result,
        message: response.message,
      })
    }

    const gatewayRef = String(response.trackId)
    return {
      gatewayRef,
      redirectUrl: `${this.apiBaseUrl}/start/${gatewayRef}`,
    }
  }

  async verifyPayment(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    const trackId = Number(input.gatewayRef)
    if (!Number.isFinite(trackId)) {
      return { ok: false, failureReason: 'Invalid Zibal trackId' }
    }

    const response = await this.postJson<ZibalVerifyResponse>('/v1/verify', {
      merchant: this.merchant,
      trackId,
    })

    if (response.result === ZIBAL_ALREADY_VERIFIED) {
      return {
        ok: true,
        alreadyVerified: true,
        refNumber: response.refNumber != null ? String(response.refNumber) : null,
        paidAmount: response.amount,
      }
    }

    if (response.result !== ZIBAL_OK) {
      return {
        ok: false,
        failureReason: response.message ?? `Zibal verify result ${response.result}`,
      }
    }

    if (response.amount !== undefined && response.amount !== input.expectedAmount) {
      this.logger.warn(
        `Zibal amount mismatch for track ${input.gatewayRef}: expected ${input.expectedAmount}, got ${response.amount}`
      )
      return {
        ok: false,
        failureReason: 'Paid amount does not match the order',
        paidAmount: response.amount,
      }
    }

    return {
      ok: true,
      refNumber: response.refNumber != null ? String(response.refNumber) : null,
      paidAmount: response.amount,
    }
  }

  parseCallback(raw: Record<string, string | undefined>): ParsedGatewayCallback {
    const gatewayRef = raw.trackId?.trim()
    if (!gatewayRef) {
      throw new PaymentGatewayError('Zibal callback is missing trackId')
    }

    const successFlag = raw.success === '1' || raw.success === 'true'
    const status = raw.status !== undefined ? Number(raw.status) : NaN
    const reportedSuccess = successFlag && (Number.isNaN(status) || status === ZIBAL_STATUS_PAID)

    return { gatewayRef, reportedSuccess }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new PaymentGatewayError('Failed to reach Zibal', {
        provider: this.provider,
        path,
        cause: error instanceof Error ? error.message : String(error),
      })
    }

    if (!response.ok) {
      throw new PaymentGatewayError('Zibal HTTP error', {
        provider: this.provider,
        path,
        status: response.status,
      })
    }

    return (await response.json()) as T
  }
}
