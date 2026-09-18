import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { createTransport, Transporter } from 'nodemailer'
import { MailConfig } from '@config/mail.config'
import { Mail, MailSender } from '@shared/application/ports/mail-sender.port'

@Injectable()
export class NodemailerMailSender implements MailSender {
  private readonly config: MailConfig
  private transporter?: Transporter

  constructor(
    configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
  ) {
    this.config = configService.getOrThrow<MailConfig>('mail')
  }

  async send(mail: Mail): Promise<void> {
    if (!this.config.host) {
      this.logger.warn(
        `MAIL_HOST is not configured; dropping mail to ${mail.to} (${mail.subject})`,
        'Mail'
      )
      return
    }

    await this.getTransporter().sendMail({
      from: this.config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  }

  private getTransporter(): Transporter {
    this.transporter ??= createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.user ? { user: this.config.user, pass: this.config.password } : undefined,
    })

    return this.transporter
  }
}
