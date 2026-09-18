import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { OtpConfig } from '@config/otp.config'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import {
  OTP_CHALLENGE_STORE,
  OtpChallengeStore,
} from '@shared/application/ports/otp-challenge-store.port'
import { OTP_GENERATOR, OtpGenerator } from '@shared/application/ports/otp-generator.port'
import { SMS_SENDER, SmsSender } from '@shared/application/ports/sms-sender.port'
import { UseCase } from '@shared/application/use-case'
import { User } from '../../domain/entities/user.aggregate'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo'
import { RequestOtpCommand } from '../dto/commands'
import { OtpRequestedView } from '../dto/views'

/**
 * Starts a customer login. The one-time code is stored in Redis with a short
 * TTL (default 2 minutes); the user row is only ensured to exist.
 */
@Injectable()
export class RequestOtpUseCase implements UseCase<RequestOtpCommand, OtpRequestedView> {
  private readonly otpConfig: OtpConfig

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_GENERATOR) private readonly otpGenerator: OtpGenerator,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    @Inject(OTP_CHALLENGE_STORE) private readonly otpStore: OtpChallengeStore,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    configService: ConfigService
  ) {
    this.otpConfig = configService.getOrThrow<OtpConfig>('otp')
  }

  async execute({ phoneNumber }: RequestOtpCommand): Promise<OtpRequestedView> {
    const phone = PhoneNumber.create(phoneNumber)
    const now = this.clock.now()

    const existing = await this.users.findByPhoneNumber(phone)
    if (!existing) {
      await this.users.save(User.register(phone, now))
    }

    const code = this.otpGenerator.generate()
    const expiresAt = await this.otpStore.save(phone.value, code, this.otpConfig.ttlSeconds)

    await this.smsSender.sendOtp({ phoneNumber: phone.value, code })

    this.logger.log(
      `Issued login code for ${phone.masked} (TTL ${this.otpConfig.ttlSeconds}s)`,
      'RequestOtp'
    )

    return {
      phoneNumber: phone.masked,
      expiresAt,
      ...(this.otpConfig.exposeInResponse ? { code } : {}),
    }
  }
}
