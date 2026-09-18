import { formatOrderDayKey } from './order-number'

describe('formatOrderDayKey', () => {
  it('uses the Asia/Tehran calendar date, not UTC', () => {
    // 21:00 UTC is 00:30 the next day in Tehran (UTC+3:30).
    const utcEvening = new Date('2026-09-17T21:00:00.000Z')
    expect(formatOrderDayKey(utcEvening)).toBe('20260918')
  })

  it('keeps the same calendar day while Tehran is still on that date', () => {
    const utcAfternoon = new Date('2026-09-17T12:00:00.000Z')
    expect(formatOrderDayKey(utcAfternoon)).toBe('20260917')
  })
})
