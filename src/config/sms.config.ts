import { registerAs } from '@nestjs/config'
import { SmsDriver } from './env.validation'

export const smsConfig = registerAs('sms', () => ({
  driver: (process.env.SMS_DRIVER as SmsDriver) ?? SmsDriver.Console,
  kavenegar: {
    apiKey: process.env.KAVENEGAR_API_KEY ?? '',
    otpTemplate: process.env.KAVENEGAR_OTP_TEMPLATE ?? '',
  },
}))

export type SmsConfig = ReturnType<typeof smsConfig>
