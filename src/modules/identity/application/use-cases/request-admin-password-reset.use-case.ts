import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { MailConfig } from '@config/mail.config'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { MAIL_SENDER, MailSender } from '@shared/application/ports/mail-sender.port'
import { SECURE_RANDOM, SecureRandom } from '@shared/application/ports/secure-random.port'
import { UseCase } from '@shared/application/use-case'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { PasswordResetToken } from '../../domain/value-objects/password-reset-token.vo'
import { RequestAdminPasswordResetCommand } from '../dto/commands'

const TOKEN_LENGTH = 6

/**
 * Sends a short-lived reset token to an admin's mailbox.
 *
 * Succeeds even when the email is unknown: telling a caller whether an address
 * belongs to an admin would leak account existence.
 */
@Injectable()
export class RequestAdminPasswordResetUseCase implements UseCase<
  RequestAdminPasswordResetCommand,
  void
> {
  private readonly mailConfig: MailConfig

  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    @Inject(SECURE_RANDOM) private readonly secureRandom: SecureRandom,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    configService: ConfigService
  ) {
    this.mailConfig = configService.getOrThrow<MailConfig>('mail')
  }

  async execute({ email }: RequestAdminPasswordResetCommand): Promise<void> {
    const address = EmailAddress.create(email)
    const admin = await this.admins.findByEmail(address)

    if (!admin) {
      this.logger.warn(`Password reset requested for unknown admin ${address.value}`, 'AdminAuth')
      return
    }

    admin.ensureActive()

    const token = this.secureRandom.alphanumeric(TOKEN_LENGTH)
    const expiresAt = this.clock.secondsFromNow(this.mailConfig.passwordResetTtlSeconds)

    admin.requestPasswordReset(PasswordResetToken.create(token, expiresAt))
    await this.admins.save(admin)

    const minutes = Math.round(this.mailConfig.passwordResetTtlSeconds / 60)

    await this.mailSender.send({
      to: admin.email.value,
      subject: 'درخواست بازنشانی رمز عبور',
      text: `کد بازنشانی رمز عبور شما: ${token}\nاین کد تا ${minutes} دقیقه اعتبار دارد.`,
    })
  }
}
