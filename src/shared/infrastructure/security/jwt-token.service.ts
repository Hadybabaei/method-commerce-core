import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { JwtConfig } from '@config/jwt.config'
import { TokenClaims, TokenService } from '@shared/application/ports/token-service.port'
import { UnauthenticatedError } from '@shared/domain/errors'

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly config: JwtConfig

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService
  ) {
    this.config = configService.getOrThrow<JwtConfig>('jwt')
  }

  signAccessToken(claims: Omit<TokenClaims, 'type'>): Promise<string> {
    const ttl = claims.audience === 'admin' ? this.config.adminAccessTtl : this.config.accessTtl

    return this.jwtService.signAsync({ ...claims, type: 'access' }, this.expiresIn(ttl))
  }

  signRefreshToken(claims: Omit<TokenClaims, 'type'>): Promise<string> {
    return this.jwtService.signAsync(
      { ...claims, type: 'refresh' },
      this.expiresIn(this.config.refreshTtl)
    )
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      return await this.jwtService.verifyAsync<TokenClaims>(token)
    } catch {
      throw new UnauthenticatedError('Invalid or expired token')
    }
  }

  /** TTLs come from configuration as strings such as `1d`, `12h`. */
  private expiresIn(ttl: string): JwtSignOptions {
    return { expiresIn: ttl as JwtSignOptions['expiresIn'] }
  }
}
