import { appConfig } from './app.config'
import { jwtConfig } from './jwt.config'
import { loggerConfig } from './logger.config'
import { mailConfig } from './mail.config'
import { orderingJobsConfig } from './ordering-jobs.config'
import { otpConfig } from './otp.config'
import { paymentConfig } from './payment.config'
import { redisConfig } from './redis.config'
import { searchConfig } from './search.config'
import { smsConfig } from './sms.config'
import { storageConfig } from './storage.config'
import { uploadConfig } from './upload.config'

export const configurations = [
  appConfig,
  jwtConfig,
  loggerConfig,
  mailConfig,
  orderingJobsConfig,
  otpConfig,
  paymentConfig,
  redisConfig,
  searchConfig,
  smsConfig,
  storageConfig,
  uploadConfig,
]

export * from './app.config'
export * from './env.validation'
export * from './jwt.config'
export * from './logger.config'
export * from './mail.config'
export * from './ordering-jobs.config'
export * from './otp.config'
export * from './payment.config'
export * from './redis.config'
export * from './search.config'
export * from './sms.config'
export * from './storage.config'
export * from './upload.config'
