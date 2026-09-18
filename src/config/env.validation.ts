import { plainToInstance, Type } from 'class-transformer'
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MinLength,
  validateSync,
} from 'class-validator'

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum SmsDriver {
  Console = 'console',
  Kavenegar = 'kavenegar',
}

export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Http = 'http',
  Debug = 'debug',
}

/**
 * Fail fast on boot rather than on the first request that needs a missing key.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development

  @Type(() => Number)
  @IsInt()
  @Max(65535)
  @IsOptional()
  PORT = 4000

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters long' })
  JWT_SECRET: string

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '1d'

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '7d'

  @IsString()
  @IsOptional()
  JWT_ADMIN_ACCESS_TTL = '12h'

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  OTP_LENGTH = 5

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  OTP_TTL_SECONDS = 120

  @IsBooleanString()
  @IsOptional()
  OTP_EXPOSE_IN_RESPONSE?: string

  @IsEnum(SmsDriver)
  @IsOptional()
  SMS_DRIVER: SmsDriver = SmsDriver.Console

  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.Info

  @IsString()
  @IsOptional()
  PAYMENT_PROVIDER?: string

  @IsString()
  @IsOptional()
  ZIBAL_MERCHANT?: string

  @IsString()
  @IsOptional()
  ZIBAL_API_BASE_URL?: string

  @IsString()
  @IsOptional()
  ZIBAL_CALLBACK_URL?: string

  @IsString()
  @IsOptional()
  REDIS_URL?: string

  @IsBooleanString()
  @IsOptional()
  REDIS_ENABLED?: string

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  ORDER_UNPAID_CANCEL_DELAY_MS = 900_000

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  ORDER_PAYMENT_INQUIRY_INTERVAL_MS = 60_000
}

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })
  const errors = validateSync(parsed, { skipMissingProperties: false, whitelist: false })

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n')

    throw new Error(`Invalid environment configuration:\n${messages}`)
  }

  // Keep the raw env so namespaced config factories stay the single source of truth.
  return raw
}
