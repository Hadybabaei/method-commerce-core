/* eslint-disable @typescript-eslint/no-explicit-any -- a loose fake of the Prisma delegate */
import { PrismaOtpChallengeStore } from './prisma-otp-challenge.store'
import { PrismaService } from './prisma.service'

/** A one-table stand-in for Prisma's otp_challenge delegate. */
function fakePrisma() {
  const rows = new Map<string, { phone_number: string; code: string; expires_at: Date }>()
  const matches = (
    row: { code: string; expires_at: Date },
    where: { code?: string; expires_at?: { gt: Date } }
  ) =>
    (where.code === undefined || row.code === where.code) &&
    (where.expires_at === undefined || row.expires_at > where.expires_at.gt)
  return {
    rows,
    prisma: {
      otp_challenge: {
        upsert: async ({ where, create, update }: any) => {
          rows.set(where.phone_number, { ...(rows.get(where.phone_number) ?? create), ...update })
        },
        deleteMany: async ({ where }: any) => {
          const row = rows.get(where.phone_number)
          if (row && matches(row, where)) {
            rows.delete(where.phone_number)
            return { count: 1 }
          }
          return { count: 0 }
        },
        findUnique: async ({ where }: any) => rows.get(where.phone_number) ?? null,
      },
    } as unknown as PrismaService,
  }
}

describe('PrismaOtpChallengeStore', () => {
  it('accepts the right code once, keeps it after a wrong one, and expires it', async () => {
    let now = 1_000_000
    const { prisma, rows } = fakePrisma()
    const store = new PrismaOtpChallengeStore(prisma, () => now)

    expect(await store.save('09120000000', '12345', 120)).toEqual(new Date(1_000_000 + 120_000))
    expect(await store.consume('09120000000', '99999')).toBe('mismatch')
    expect(await store.consume('09120000000', ' 12345 ')).toBe('ok')
    expect(await store.consume('09120000000', '12345')).toBe('missing')

    await store.save('09120000000', '55555', 60)
    now += 61_000
    expect(await store.consume('09120000000', '55555')).toBe('missing')
    expect(rows.size).toBe(0)
  })
})
