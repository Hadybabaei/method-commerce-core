import { registerAs } from '@nestjs/config'

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '1d',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  adminAccessTtl: process.env.JWT_ADMIN_ACCESS_TTL ?? '12h',
}))

export type JwtConfig = ReturnType<typeof jwtConfig>
