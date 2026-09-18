import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { OtpSms, SmsSender } from '@shared/application/ports/sms-sender.port'

/**
 * Development adapter: writes the message to the log instead of sending it.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

  async sendOtp({ phoneNumber, code }: OtpSms): Promise<void> {
    this.logger.log(`OTP for ${phoneNumber}: ${code}`, 'ConsoleSmsSender')
  }

  async send(phoneNumber: string, text: string): Promise<void> {
    this.logger.log(`SMS to ${phoneNumber}: ${text}`, 'ConsoleSmsSender')
  }
}
