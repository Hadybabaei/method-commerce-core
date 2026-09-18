export type TokenAudience = 'user' | 'admin'
export type TokenType = 'access' | 'refresh'

export interface TokenClaims {
  /** Aggregate id of the authenticated user or admin. */
  sub: number
  role: string
  audience: TokenAudience
  type: TokenType
  phoneNumber?: string
  email?: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenService {
  signAccessToken(claims: Omit<TokenClaims, 'type'>): Promise<string>
  signRefreshToken(claims: Omit<TokenClaims, 'type'>): Promise<string>
  verify(token: string): Promise<TokenClaims>
}

export const TOKEN_SERVICE = Symbol('TokenService')
