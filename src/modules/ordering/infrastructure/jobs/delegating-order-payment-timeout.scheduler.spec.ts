import { ModuleRef } from '@nestjs/core'
import {
  BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../../application/ports/order-payment-timeout.port'
import { DelegatingOrderPaymentTimeoutScheduler } from './delegating-order-payment-timeout.scheduler'

describe('DelegatingOrderPaymentTimeoutScheduler', () => {
  const originalRedis = process.env.REDIS_ENABLED

  afterEach(() => {
    if (originalRedis === undefined) {
      delete process.env.REDIS_ENABLED
    } else {
      process.env.REDIS_ENABLED = originalRedis
    }
  })

  it('stays a no-op when jobs are disabled', () => {
    delete process.env.REDIS_ENABLED
    const scheduler = new DelegatingOrderPaymentTimeoutScheduler({
      get: () => {
        throw new Error('should not resolve BullMQ when jobs are off')
      },
    } as unknown as ModuleRef)

    expect(scheduler.isOperational).toBe(false)
  })

  it('uses the BullMQ adapter when jobs are enabled', async () => {
    process.env.REDIS_ENABLED = 'true'
    const scheduled: number[] = []
    const bull: OrderPaymentTimeoutScheduler = {
      isOperational: true,
      async scheduleCancelIfUnpaid(orderId: number) {
        scheduled.push(orderId)
      },
      async cancelScheduled() {
        /* unused */
      },
    }
    const scheduler = new DelegatingOrderPaymentTimeoutScheduler({
      get: (token: unknown) => {
        expect(token).toBe(BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER)
        return bull
      },
    } as unknown as ModuleRef)

    expect(scheduler.isOperational).toBe(true)
    await scheduler.scheduleCancelIfUnpaid(42, 1_000)
    expect(scheduled).toEqual([42])
  })
})
