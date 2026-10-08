import { CallHandler, ExecutionContext } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'
import { AuditLog } from './application/backoffice.ports'
import { csvField, toCsv } from './domain/csv'
import { startOfTehranDay, startOfTehranMonth, tehranDay } from './domain/tehran-time'
import {
  AdminAuditInterceptor,
  auditTarget,
  redact,
} from './infrastructure/admin-audit.interceptor'

describe('Tehran time', () => {
  it('starts the day at 00:00 Tehran (20:30 UTC the day before)', () => {
    // 2026-10-09 01:00 Tehran = 2026-10-08 21:30 UTC
    const instant = new Date('2026-10-08T21:30:00Z')
    expect(startOfTehranDay(instant).toISOString()).toBe('2026-10-08T20:30:00.000Z')
    expect(tehranDay(instant)).toBe('2026-10-09')
    expect(tehranDay(new Date('2026-10-08T20:29:59Z'))).toBe('2026-10-08')
  })

  it('starts the month on the 1st, Tehran time', () => {
    expect(startOfTehranMonth(new Date('2026-10-31T21:00:00Z')).toISOString()).toBe(
      '2026-10-31T20:30:00.000Z' // already 1 November in Tehran
    )
    expect(startOfTehranMonth(new Date('2026-10-15T12:00:00Z')).toISOString()).toBe(
      '2026-09-30T20:30:00.000Z'
    )
  })
})

describe('CSV', () => {
  it('quotes commas, quotes and new lines, and defuses formulas', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvField(-5)).toBe('-5')
    expect(csvField(null)).toBe('')
  })

  it('starts with a BOM so Excel reads Persian', () => {
    const csv = toCsv(['name'], [['دریل']])
    expect(csv.startsWith('﻿name\r\n')).toBe(true)
    expect(csv).toContain('دریل')
  })
})

describe('Admin audit', () => {
  it('removes secrets at any depth', () => {
    expect(redact({ email: 'a@b.c', password: 'x', nested: [{ resetToken: 'y', ok: 1 }] })).toEqual(
      { email: 'a@b.c', password: '[redacted]', nested: [{ resetToken: '[redacted]', ok: 1 }] }
    )
  })

  it('names the resource and id from the route', () => {
    expect(auditTarget('/api/admin/orders/:id/refunds', { id: '42' })).toEqual({
      entity: 'orders',
      entityId: '42',
    })
    expect(auditTarget('/api/admin/stock/:variantId/adjust', { variantId: '7' })).toEqual({
      entity: 'stock',
      entityId: '7',
    })
    expect(auditTarget('/api/admin/promotions', {})).toEqual({
      entity: 'promotions',
      entityId: null,
    })
  })

  function run(request: Record<string, unknown>, statusCode = 201) {
    const audit = { record: jest.fn().mockResolvedValue(undefined), list: jest.fn() }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode }) }),
    } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of({ id: 1 }) }
    const interceptor = new AdminAuditInterceptor(audit as unknown as AuditLog)
    return { audit, done: lastValueFrom(interceptor.intercept(context, next)) }
  }

  it('records successful admin changes without secrets', async () => {
    const { audit, done } = run({
      method: 'POST',
      url: '/api/admin/accounts',
      route: { path: '/api/admin/accounts' },
      params: {},
      body: { email: 'op@x.ir', password: 'secret123' },
      actor: { id: 3, audience: 'admin' },
    })
    await done

    expect(audit.record).toHaveBeenCalledWith({
      adminId: 3,
      action: 'POST /admin/accounts',
      entity: 'accounts',
      entityId: null,
      payload: { email: 'op@x.ir', password: '[redacted]' },
      status: 201,
    })
  })

  it.each([
    ['reads', { method: 'GET', actor: { id: 3, audience: 'admin' } }],
    ['customer requests', { method: 'POST', actor: { id: 3, audience: 'user' } }],
    ['anonymous requests', { method: 'POST' }],
  ])('ignores %s', async (_, request) => {
    const { audit, done } = run({ url: '/api/admin/x', params: {}, body: {}, ...request })
    await done
    expect(audit.record).not.toHaveBeenCalled()
  })
})
