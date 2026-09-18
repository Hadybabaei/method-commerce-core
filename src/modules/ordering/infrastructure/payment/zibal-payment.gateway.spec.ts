import { PaymentGatewayError } from '../../domain/errors/ordering.errors'
import { ZibalPaymentGateway } from '../../infrastructure/payment/zibal-payment.gateway'

describe('ZibalPaymentGateway', () => {
  function gateway(fetchImpl: typeof fetch) {
    const original = globalThis.fetch
    globalThis.fetch = fetchImpl
    const instance = new ZibalPaymentGateway({
      getOrThrow: () => ({
        provider: 'zibal',
        zibal: {
          merchant: 'zibal',
          apiBaseUrl: 'https://gateway.zibal.ir',
          callbackUrl: 'http://localhost:4000/api/payments/callback',
        },
      }),
    } as never)

    return {
      instance,
      restore: () => {
        globalThis.fetch = original
      },
    }
  }

  it('creates a payment and builds the start redirect URL', async () => {
    const { instance, restore } = gateway(async () =>
      Response.json({ result: 100, trackId: 9900, message: 'success' })
    )

    try {
      const session = await instance.createPayment({
        amount: 2_000_000,
        merchantOrderId: 'checkout-1',
        description: 'Order ORD-1',
      })

      expect(session.gatewayRef).toBe('9900')
      expect(session.redirectUrl).toBe('https://gateway.zibal.ir/start/9900')
    } finally {
      restore()
    }
  })

  it('rejects a non-100 request result', async () => {
    const { instance, restore } = gateway(async () =>
      Response.json({ result: 102, message: 'merchant not found' })
    )

    try {
      await expect(
        instance.createPayment({ amount: 1000, merchantOrderId: 'x' })
      ).rejects.toBeInstanceOf(PaymentGatewayError)
    } finally {
      restore()
    }
  })

  it('verifies a paid track and treats 201 as already verified', async () => {
    const { instance, restore } = gateway(async () =>
      Response.json({ result: 100, amount: 5000, refNumber: 'R1' })
    )

    try {
      await expect(
        instance.verifyPayment({ gatewayRef: '9900', expectedAmount: 5000 })
      ).resolves.toMatchObject({ ok: true, refNumber: 'R1' })
    } finally {
      restore()
    }

    const again = gateway(async () => Response.json({ result: 201, amount: 5000 }))
    try {
      await expect(
        again.instance.verifyPayment({ gatewayRef: '9900', expectedAmount: 5000 })
      ).resolves.toMatchObject({ ok: true, alreadyVerified: true })
    } finally {
      again.restore()
    }
  })

  it('treats a 100 verify with an amount mismatch as captured', async () => {
    const { instance, restore } = gateway(async () =>
      Response.json({ result: 100, amount: 9_999, refNumber: 'R-mismatch' })
    )

    try {
      await expect(
        instance.verifyPayment({ gatewayRef: '9900', expectedAmount: 5000 })
      ).resolves.toMatchObject({ ok: true, paidAmount: 9_999, refNumber: 'R-mismatch' })
    } finally {
      restore()
    }
  })

  it('parses Zibal callback query params', () => {
    const { instance, restore } = gateway(async () => Response.json({}))
    try {
      expect(instance.parseCallback({ trackId: '99', success: '1', status: '2' })).toEqual({
        gatewayRef: '99',
        reportedSuccess: true,
      })
      expect(instance.parseCallback({ trackId: '99', success: '0', status: '3' })).toEqual({
        gatewayRef: '99',
        reportedSuccess: false,
      })
    } finally {
      restore()
    }
  })

  it('aborts hanging Zibal HTTP calls', async () => {
    const { instance, restore } = gateway(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return Response.json({ result: 100, trackId: 1 })
    })

    try {
      await instance.createPayment({ amount: 1000, merchantOrderId: 'x' })
    } finally {
      restore()
    }
  })
})
