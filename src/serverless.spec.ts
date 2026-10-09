import { withPoolerFlag } from './serverless'

describe('withPoolerFlag', () => {
  it('flags pooled Neon URLs for Prisma and leaves the rest alone', () => {
    expect(
      withPoolerFlag('postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require')
    ).toBe(
      'postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require&pgbouncer=true'
    )
    expect(withPoolerFlag('postgresql://u:p@ep-x-pooler.neon.tech/db')).toBe(
      'postgresql://u:p@ep-x-pooler.neon.tech/db?pgbouncer=true'
    )
    expect(withPoolerFlag('postgresql://u:p@ep-x-pooler.neon.tech/db?pgbouncer=true')).toBe(
      'postgresql://u:p@ep-x-pooler.neon.tech/db?pgbouncer=true'
    )
    expect(withPoolerFlag('postgresql://u:p@localhost:5432/db')).toBe(
      'postgresql://u:p@localhost:5432/db'
    )
    expect(withPoolerFlag(undefined)).toBeUndefined()
  })
})
