import { Queue, Worker } from 'bullmq'
import { BullmqOrderPaymentTimeoutScheduler } from './bullmq-order-payment-timeout.scheduler'
import {
  CANCEL_UNPAID_ORDER_JOB,
  CancelUnpaidOrderJobData,
  UNPAID_ORDER_QUEUE,
} from '../../application/ports/order-payment-timeout.port'
import { REDIS_URL, connectLiveRedis, sleep } from '@shared/infrastructure/redis/redis-live.support'

/** Production default is 15 minutes; live tests wait a real 10 seconds. */
const DELAY_MS = 10_000

describe('Unpaid ONLINE cancel (live Redis + BullMQ)', () => {
  const prefix = `{method-commerce-unpaid-test}-${process.pid}-${Date.now()}`
  const connection = { url: REDIS_URL, maxRetriesPerRequest: null as const }

  let queue: Queue<CancelUnpaidOrderJobData>
  let worker: Worker<CancelUnpaidOrderJobData>
  let scheduler: BullmqOrderPaymentTimeoutScheduler
  const processed: number[] = []

  beforeAll(async () => {
    const probe = await connectLiveRedis()
    await probe.quit()

    queue = new Queue<CancelUnpaidOrderJobData>(UNPAID_ORDER_QUEUE, { connection, prefix })
    scheduler = new BullmqOrderPaymentTimeoutScheduler(queue)
    worker = new Worker<CancelUnpaidOrderJobData>(
      UNPAID_ORDER_QUEUE,
      async (job) => {
        if (job.name === CANCEL_UNPAID_ORDER_JOB) {
          processed.push(job.data.orderId)
        }
      },
      { connection, prefix }
    )
    await worker.waitUntilReady()
  })

  afterAll(async () => {
    await worker?.close()
    await queue?.obliterate({ force: true }).catch(() => undefined)
    await queue?.close()
  })

  beforeEach(() => {
    processed.length = 0
  })

  it('does not fire the cancel job before the 10s delay', async () => {
    const orderId = 401
    await scheduler.scheduleCancelIfUnpaid(orderId, DELAY_MS)

    await sleep(3_000)

    expect(processed).not.toContain(orderId)
    await scheduler.cancelScheduled(orderId)
  })

  it('fires the delayed cancel job after 10s', async () => {
    const orderId = 402
    await scheduler.scheduleCancelIfUnpaid(orderId, DELAY_MS)

    await sleep(DELAY_MS + 1_500)

    expect(processed).toContain(orderId)
  })

  it('does not fire after cancelScheduled (pay / manual cancel)', async () => {
    const orderId = 403
    await scheduler.scheduleCancelIfUnpaid(orderId, DELAY_MS)
    await scheduler.cancelScheduled(orderId)

    await sleep(DELAY_MS + 1_500)

    expect(processed).not.toContain(orderId)
  })
})
