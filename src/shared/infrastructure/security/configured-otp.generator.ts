import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OtpConfig } from '@config/otp.config'
import { OtpGenerator } from '@shared/application/ports/otp-generator.port'
import { SECURE_RANDOM, SecureRandom } from '@shared/application/ports/secure-random.port'

@Injectable()
export class ConfiguredOtpGenerator implements OtpGenerator {
  private readonly length: number

  constructor(
    configService: ConfigService,
    @Inject(SECURE_RANDOM) private readonly secureRandom: SecureRandom
  ) {
    this.length = configService.getOrThrow<OtpConfig>('otp').length
  }

  generate(): string {
    return this.secureRandom.digits(this.length)
  }
}
