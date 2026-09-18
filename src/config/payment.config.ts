import { registerAs } from '@nestjs/config'

/**
 * Online payment config. Provider is selected by `PAYMENT_PROVIDER` (default: zibal).
 * `ZIBAL_MERCHANT` is required outside tests — there is no default, so a
 * missing env cannot silently charge the public sandbox merchant on the live host.
 */
export const paymentConfig = registerAs('payment', () => {
  const serverUrl = (process.env.SERVER_URL ?? 'http://localhost:4000').replace(/\/$/, '')
  const apiPrefix = (process.env.API_PREFIX ?? 'api').replace(/^\/|\/$/g, '')
  const provider = (process.env.PAYMENT_PROVIDER ?? 'zibal').toLowerCase()
  const merchant = process.env.ZIBAL_MERCHANT?.trim() ?? ''

  if (provider === 'zibal' && !merchant && process.env.NODE_ENV !== 'test') {
    throw new Error('ZIBAL_MERCHANT is required when PAYMENT_PROVIDER=zibal')
  }

  return {
    provider,
    zibal: {
      merchant,
      apiBaseUrl: (process.env.ZIBAL_API_BASE_URL ?? 'https://gateway.zibal.ir').replace(/\/$/, ''),
      callbackUrl:
        process.env.ZIBAL_CALLBACK_URL ?? `${serverUrl}/${apiPrefix}/payments/callback`,
    },
  }
})

export type PaymentConfig = ReturnType<typeof paymentConfig>
