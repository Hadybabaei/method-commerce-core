/**
 * Outbound port for online payment providers (adapter pattern).
 * Application use cases depend on this — never on Zibal/HTTP details.
 */
export interface CreateGatewayPaymentInput {
  /** Amount in Rial (integer). */
  amount: number
  /** Merchant-side reference sent to the provider (our payment idempotency key). */
  merchantOrderId: string
  description?: string
  mobileNumber?: string
}

export interface CreateGatewayPaymentResult {
  /** Provider tracking id (Zibal `trackId`). Stored as `payment.gatewayRef`. */
  gatewayRef: string
  /** URL the customer must open to pay. */
  redirectUrl: string
}

export interface VerifyGatewayPaymentInput {
  gatewayRef: string
  /** Expected amount in Rial — must match the provider receipt. */
  expectedAmount: number
}

export interface VerifyGatewayPaymentResult {
  ok: boolean
  /** Provider already verified this track (idempotent replay). */
  alreadyVerified?: boolean
  refNumber?: string | null
  paidAmount?: number
  failureReason?: string | null
}

export interface ParsedGatewayCallback {
  gatewayRef: string
  /** Whether the provider reported a successful checkout attempt. */
  reportedSuccess: boolean
}

export interface PaymentGateway {
  readonly provider: string

  createPayment(input: CreateGatewayPaymentInput): Promise<CreateGatewayPaymentResult>

  verifyPayment(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult>

  /** Normalise provider-specific callback query/body into a shared shape. */
  parseCallback(raw: Record<string, string | undefined>): ParsedGatewayCallback
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway')
