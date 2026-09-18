import {
  assertProductionOrderingJobs,
  isOrderingJobsEnabled,
} from './ordering-jobs.enabled'

describe('ordering jobs gate', () => {
  const originalEnv = process.env.NODE_ENV
  const originalRedis = process.env.REDIS_ENABLED

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    if (originalRedis === undefined) {
      delete process.env.REDIS_ENABLED
    } else {
      process.env.REDIS_ENABLED = originalRedis
    }
  })

  it('is disabled in test when REDIS_ENABLED is unset', () => {
    delete process.env.REDIS_ENABLED
    process.env.NODE_ENV = 'test'
    expect(isOrderingJobsEnabled()).toBe(false)
  })

  it('throws in production when Redis jobs are disabled', () => {
    process.env.NODE_ENV = 'production'
    process.env.REDIS_ENABLED = 'false'
    expect(() => assertProductionOrderingJobs()).toThrow(/Redis\/BullMQ/)
  })

  it('allows production boot when jobs are enabled', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.REDIS_ENABLED
    expect(() => assertProductionOrderingJobs()).not.toThrow()
  })
})
