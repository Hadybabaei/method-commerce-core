import { Global, LoggerService, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { JwtConfig } from '@config/jwt.config'
import { SmsConfig } from '@config/sms.config'
import { SmsDriver } from '@config/env.validation'
import { CLOCK } from '@shared/application/ports/clock.port'
import { EVENT_PUBLISHER } from '@shared/application/ports/event-publisher.port'
import { IMAGE_UPLOADER } from '@shared/application/ports/image-uploader.port'
import { MAIL_SENDER } from '@shared/application/ports/mail-sender.port'
import { OBJECT_STORAGE } from '@shared/application/ports/object-storage.port'
import { OTP_GENERATOR } from '@shared/application/ports/otp-generator.port'
import { SECURE_RANDOM } from '@shared/application/ports/secure-random.port'
import { SMS_SENDER } from '@shared/application/ports/sms-sender.port'
import { TOKEN_SERVICE } from '@shared/application/ports/token-service.port'
import { PASSWORD_HASHER } from '@shared/domain/services/password-hasher'
import { NestEventPublisher } from './events/nest-event-publisher'
import { NodemailerMailSender } from './mail/nodemailer-mail.sender'
import { BcryptPasswordHasher } from './security/bcrypt-password-hasher'
import { ConfiguredOtpGenerator } from './security/configured-otp.generator'
import { CryptoSecureRandom } from './security/crypto-secure-random'
import { JwtTokenService } from './security/jwt-token.service'
import { ConsoleSmsSender } from './sms/console-sms.sender'
import { KavenegarSmsSender } from './sms/kavenegar-sms.sender'
import { ConfiguredImageUploader } from './storage/configured-image-uploader'
import { LocalDiskObjectStorage } from './storage/local-disk-object-storage'
import { SystemClock } from './time/system.clock'

/**
 * Single place where application/domain ports are bound to concrete adapters.
 * Feature modules depend on the port symbols only, never on these classes.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<JwtConfig>('jwt').secret,
      }),
    }),
  ],
  providers: [
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: CLOCK, useClass: SystemClock },
    { provide: SECURE_RANDOM, useClass: CryptoSecureRandom },
    { provide: OTP_GENERATOR, useClass: ConfiguredOtpGenerator },
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
    { provide: EVENT_PUBLISHER, useClass: NestEventPublisher },
    { provide: OBJECT_STORAGE, useClass: LocalDiskObjectStorage },
    { provide: IMAGE_UPLOADER, useClass: ConfiguredImageUploader },
    {
      provide: SMS_SENDER,
      inject: [ConfigService, WINSTON_MODULE_NEST_PROVIDER],
      useFactory: (configService: ConfigService, logger: LoggerService) => {
        const { driver } = configService.getOrThrow<SmsConfig>('sms')

        return driver === SmsDriver.Kavenegar
          ? new KavenegarSmsSender(configService, logger)
          : new ConsoleSmsSender(logger)
      },
    },
  ],
  exports: [
    JwtModule,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    CLOCK,
    SECURE_RANDOM,
    OTP_GENERATOR,
    MAIL_SENDER,
    SMS_SENDER,
    EVENT_PUBLISHER,
    OBJECT_STORAGE,
    IMAGE_UPLOADER,
  ],
})
export class SharedInfrastructureModule {}
