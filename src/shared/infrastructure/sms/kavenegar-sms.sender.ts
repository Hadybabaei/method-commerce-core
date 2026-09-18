import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { SmsConfig } from '@config/sms.config'
import { OtpSms, SmsSender } from '@shared/application/ports/sms-sender.port'

const KAVENEGAR_BASE_URL = 'https://api.kavenegar.com/v1'

/**
 * Kavenegar adapter. `verify/lookup` is the template-based OTP endpoint;
 * `sms/send` is the plain-text one.
 */
@Injectable()
export class KavenegarSmsSender implements SmsSender {
  private readonly config: SmsConfig['kavenegar']

  constructor(
    configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
  ) {
    this.config = configService.getOrThrow<SmsConfig>('sms').kavenegar
  }

  async sendOtp({ phoneNumber, code }: OtpSms): Promise<void> {
    await this.call('verify/lookup.json', {
      receptor: phoneNumber,
      token: code,
      template: this.config.otpTemplate,
    })
  }

  async send(phoneNumber: string, text: string): Promise<void> {
    await this.call('sms/send.json', { receptor: phoneNumber, message: text })
  }

  private async call(path: string, params: Record<string, string>): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('KAVENEGAR_API_KEY is not configured')
    }

    const url = `${KAVENEGAR_BASE_URL}/${this.config.apiKey}/${path}?${new URLSearchParams(params)}`
    const response = await fetch(url, { method: 'POST' })

    if (!response.ok) {
      const body = await response.text()
      this.logger.error(`Kavenegar request failed: ${response.status} ${body}`, undefined, 'Sms')
      throw new Error(`SMS provider responded with ${response.status}`)
    }
  }
}
