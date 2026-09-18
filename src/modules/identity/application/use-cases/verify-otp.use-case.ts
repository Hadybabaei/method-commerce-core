import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import {
  OTP_CHALLENGE_STORE,
  OtpChallengeStore,
} from '@shared/application/ports/otp-challenge-store.port'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { UseCase } from '@shared/application/use-case'
import {
  InvalidOtpError,
  OtpExpiredError,
  UserNotFoundError,
} from '../../domain/errors/identity.errors'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo'
import { VerifyOtpCommand } from '../dto/commands'
import { AuthenticatedUserView } from '../dto/views'
import { toUserView } from '../mappers/identity-view.mapper'

/**
 * Completes a customer login: consumes the Redis-backed one-time code,
 * activates the account, and issues the token pair.
 */
@Injectable()
export class VerifyOtpUseCase implements UseCase<VerifyOtpCommand, AuthenticatedUserView> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_STORE) private readonly otpStore: OtpChallengeStore,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute({ phoneNumber, code }: VerifyOtpCommand): Promise<AuthenticatedUserView> {
    const phone = PhoneNumber.create(phoneNumber)
    const user = await this.users.findByPhoneNumber(phone)

    if (!user) {
      throw new UserNotFoundError(phone.masked)
    }

    const result = await this.otpStore.consume(phone.value, code)

    if (result === 'missing') {
      // Redis TTL drop and "never requested" look the same from outside.
      throw new OtpExpiredError()
    }

    if (result === 'mismatch') {
      throw new InvalidOtpError()
    }

    user.confirmPhoneVerified(this.clock.now())

    const claims = {
      sub: user.id,
      role: user.role as string,
      audience: 'user' as const,
      phoneNumber: user.phoneNumber.value,
      email: user.email?.value,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(claims),
      this.tokenService.signRefreshToken(claims),
    ])

    user.attachRefreshToken(refreshToken)
    const saved = await this.users.save(user)

    return { accessToken, refreshToken, user: toUserView(saved) }
  }
}
