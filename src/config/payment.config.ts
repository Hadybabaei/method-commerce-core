import { registerAs } from '@nestjs/config'

/**
 * Online payment config. Provider is selected by `PAYMENT_PROVIDER` (default: zibal).
 * Use merchant `zibal` against the live gateway for sandbox tests.
 */
export const paymentConfig = registerAs('payment', () => {
  const serverUrl = (process.env.SERVER_URL ?? 'http://localhost:4000').replace(/\/$/, '')
  const apiPrefix = (process.env.API_PREFIX ?? 'api').replace(/^\/|\/$/g, '')

  return {
    provider: (process.env.PAYMENT_PROVIDER ?? 'zibal').toLowerCase(),
    zibal: {
      merchant: process.env.ZIBAL_MERCHANT ?? 'zibal',
      apiBaseUrl: (process.env.ZIBAL_API_BASE_URL ?? 'https://gateway.zibal.ir').replace(/\/$/, ''),
      callbackUrl:
        process.env.ZIBAL_CALLBACK_URL ?? `${serverUrl}/${apiPrefix}/payments/callback`,
    },
  }
})

export type PaymentConfig = ReturnType<typeof paymentConfig>
