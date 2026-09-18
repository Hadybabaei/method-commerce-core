import { ConfigService } from '@nestjs/config'
import { LoggerService } from '@nestjs/common'
import { Clock } from '@shared/application/ports/clock.port'
import { EventPublisher } from '@shared/application/ports/event-publisher.port'
import { MailSender } from '@shared/application/ports/mail-sender.port'
import { OtpGenerator } from '@shared/application/ports/otp-generator.port'
import { SecureRandom } from '@shared/application/ports/secure-random.port'
import { SmsSender } from '@shared/application/ports/sms-sender.port'
import { TokenClaims, TokenService } from '@shared/application/ports/token-service.port'
import { DomainEvent } from '@shared/domain/domain-event'
import { UnauthenticatedError } from '@shared/domain/errors'
import { PasswordHasher } from '@shared/domain/services/password-hasher'
import { InMemoryOtpChallengeStore } from '@shared/infrastructure/redis/in-memory-otp-challenge.store'
import { Admin } from '../../domain/entities/admin.aggregate'
import { User } from '../../domain/entities/user.aggregate'
import { AdminRole } from '../../domain/enums/roles.enum'
import { AdminRepository } from '../../domain/repositories/admin.repository'
import { UserRepository } from '../../domain/repositories/user.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo'
import { PlainPassword } from '../../domain/value-objects/plain-password.vo'
import { LogoutUseCase } from '../use-cases/logout.use-case'
import { RefreshAccessTokenUseCase } from '../use-cases/refresh-access-token.use-case'
import { RequestOtpUseCase } from '../use-cases/request-otp.use-case'
import { VerifyOtpUseCase } from '../use-cases/verify-otp.use-case'
import { AdminLoginUseCase } from '../use-cases/admin-login.use-case'
import { ChangeAdminPasswordUseCase } from '../use-cases/change-admin-password.use-case'
import { RequestAdminPasswordResetUseCase } from '../use-cases/request-admin-password-reset.use-case'
import { ResetAdminPasswordUseCase } from '../use-cases/reset-admin-password.use-case'
import { GetCurrentUserUseCase } from '../use-cases/get-current-user.use-case'

/** Controllable wall clock for expiry scenarios. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-03-15T10:00:00.000Z')) {}

  now(): Date {
    return this.current
  }

  secondsFromNow(seconds: number): Date {
    return new Date(this.current.getTime() + seconds * 1000)
  }

  advanceSeconds(seconds: number): void {
    this.current = this.secondsFromNow(seconds)
  }

  set(date: Date): void {
    this.current = date
  }
}

export class InMemoryUserRepository implements UserRepository {
  private nextId = 1
  private readonly byId = new Map<number, User>()

  async findById(id: number): Promise<User | null> {
    return this.clone(this.byId.get(id) ?? null)
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.phoneNumber.equals(phoneNumber)) {
        return this.clone(user)
      }
    }
    return null
  }

  async existsByPhoneNumber(phoneNumber: PhoneNumber): Promise<boolean> {
    return (await this.findByPhoneNumber(phoneNumber)) !== null
  }

  async save(user: User): Promise<User> {
    const id = user.isNew ? this.nextId++ : user.id
    const persisted = User.fromPersistence(id, {
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      type: user.type,
      authLevel: user.authLevel,
      activated: user.isActivated,
      avatar: user.avatar,
      otp: user.otp,
      refreshToken: user.refreshToken,
      profile: user.profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    user.pullDomainEvents()
    this.byId.set(id, persisted)
    return this.clone(persisted)!
  }

  /** Direct peek for assertions without going through repository cloning. */
  peek(id: number): User | undefined {
    return this.byId.get(id)
  }

  private clone(user: User | null): User | null {
    if (!user) return null
    return User.fromPersistence(user.id, {
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      type: user.type,
      authLevel: user.authLevel,
      activated: user.isActivated,
      avatar: user.avatar,
      otp: user.otp,
      refreshToken: user.refreshToken,
      profile: user.profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  }
}

export class InMemoryAdminRepository implements AdminRepository {
  private nextId = 1
  private readonly byId = new Map<number, Admin>()

  async findById(id: number): Promise<Admin | null> {
    return this.clone(this.byId.get(id) ?? null)
  }

  async findByEmail(email: EmailAddress): Promise<Admin | null> {
    for (const admin of this.byId.values()) {
      if (admin.email.equals(email)) {
        return this.clone(admin)
      }
    }
    return null
  }

  async findAll(): Promise<Admin[]> {
    return [...this.byId.values()].map((admin) => this.clone(admin)!)
  }

  async save(admin: Admin): Promise<Admin> {
    const id = admin.isNew ? this.nextId++ : admin.id
    const persisted = Admin.fromPersistence(id, {
      email: admin.email,
      passwordHash: admin.passwordHash,
      role: admin.role,
      active: admin.isActive,
      firstName: admin.firstName,
      lastName: admin.lastName,
      nationalId: admin.nationalId,
      address: admin.address,
      avatarUrl: admin.avatarUrl,
      phoneNumber: admin.phoneNumber,
      passwordReset: admin.passwordReset,
      createdAt: admin.createdAt,
    })
    admin.pullDomainEvents()
    this.byId.set(id, persisted)
    return this.clone(persisted)!
  }

  async delete(id: number): Promise<void> {
    this.byId.delete(id)
  }

  peek(id: number): Admin | undefined {
    return this.byId.get(id)
  }

  private clone(admin: Admin | null): Admin | null {
    if (!admin) return null
    return Admin.fromPersistence(admin.id, {
      email: admin.email,
      passwordHash: admin.passwordHash,
      role: admin.role,
      active: admin.isActive,
      firstName: admin.firstName,
      lastName: admin.lastName,
      nationalId: admin.nationalId,
      address: admin.address,
      avatarUrl: admin.avatarUrl,
      phoneNumber: admin.phoneNumber,
      passwordReset: admin.passwordReset,
      createdAt: admin.createdAt,
    })
  }
}

/** Opaque but reversible tokens so refresh / audience checks stay realistic. */
export class FakeTokenService implements TokenService {
  private sequence = 0

  async signAccessToken(claims: Omit<TokenClaims, 'type'>): Promise<string> {
    return this.encode({ ...claims, type: 'access' })
  }

  async signRefreshToken(claims: Omit<TokenClaims, 'type'>): Promise<string> {
    return this.encode({ ...claims, type: 'refresh' })
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      const [, payload] = token.split('.')
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims & {
        jti?: number
      }
      const { jti: _jti, ...claims } = parsed
      return claims
    } catch {
      throw new UnauthenticatedError('Invalid or expired token')
    }
  }

  private encode(claims: TokenClaims): string {
    this.sequence += 1
    return `${claims.type}.${Buffer.from(JSON.stringify({ ...claims, jti: this.sequence })).toString('base64url')}`
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`
  }
}

export class RecordingSmsSender implements SmsSender {
  readonly sent: Array<{ phoneNumber: string; code: string }> = []

  async sendOtp(input: { phoneNumber: string; code: string }): Promise<void> {
    this.sent.push(input)
  }

  async send(_phoneNumber: string, _text: string): Promise<void> {
    /* unused in OTP scenarios */
  }
}

export class RecordingMailSender implements MailSender {
  readonly sent: Array<{ to: string; subject: string; text: string }> = []

  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(message)
  }
}

export class FixedOtpGenerator implements OtpGenerator {
  constructor(private code = '12345') {}

  generate(): string {
    return this.code
  }

  setNext(code: string): void {
    this.code = code
  }
}

export class FixedSecureRandom implements SecureRandom {
  constructor(private token = 'RESET1') {}

  alphanumeric(): string {
    return this.token
  }

  digits(length: number): string {
    return '0'.repeat(length)
  }

  setNext(token: string): void {
    this.token = token
  }
}

const silentLogger: LoggerService = {
  log: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  verbose: () => undefined,
}

const noopEvents: EventPublisher = {
  async publish(_events: readonly DomainEvent[]): Promise<void> {
    /* scenario tests assert state, not side-effect handlers */
  },
}

function configService(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'otp') {
        return { ttlSeconds: 120, exposeInResponse: true, length: 5 }
      }
      if (key === 'mail') {
        return { passwordResetTtlSeconds: 900 }
      }
      throw new Error(`Unexpected config key: ${key}`)
    },
  } as ConfigService
}

export interface CustomerAuthHarness {
  clock: FakeClock
  users: InMemoryUserRepository
  sms: RecordingSmsSender
  otpGenerator: FixedOtpGenerator
  otpStore: InMemoryOtpChallengeStore
  tokens: FakeTokenService
  requestOtp: RequestOtpUseCase
  verifyOtp: VerifyOtpUseCase
  refresh: RefreshAccessTokenUseCase
  logout: LogoutUseCase
  getMe: GetCurrentUserUseCase
}

export function createCustomerAuthHarness(): CustomerAuthHarness {
  const clock = new FakeClock()
  const users = new InMemoryUserRepository()
  const sms = new RecordingSmsSender()
  const otpGenerator = new FixedOtpGenerator()
  const otpStore = new InMemoryOtpChallengeStore(() => clock.now().getTime())
  const tokens = new FakeTokenService()
  const cfg = configService()

  return {
    clock,
    users,
    sms,
    otpGenerator,
    otpStore,
    tokens,
    requestOtp: new RequestOtpUseCase(
      users,
      otpGenerator,
      sms,
      otpStore,
      clock,
      silentLogger,
      cfg
    ),
    verifyOtp: new VerifyOtpUseCase(users, otpStore, tokens, clock),
    refresh: new RefreshAccessTokenUseCase(users, tokens),
    logout: new LogoutUseCase(users),
    getMe: new GetCurrentUserUseCase(users),
  }
}

export interface AdminAuthHarness {
  clock: FakeClock
  admins: InMemoryAdminRepository
  mail: RecordingMailSender
  random: FixedSecureRandom
  hasher: FakePasswordHasher
  tokens: FakeTokenService
  login: AdminLoginUseCase
  forgotPassword: RequestAdminPasswordResetUseCase
  resetPassword: ResetAdminPasswordUseCase
  changePassword: ChangeAdminPasswordUseCase
  seedAdmin: (input?: {
    email?: string
    password?: string
    role?: AdminRole
    active?: boolean
  }) => Promise<Admin>
}

export function createAdminAuthHarness(): AdminAuthHarness {
  const clock = new FakeClock()
  const admins = new InMemoryAdminRepository()
  const mail = new RecordingMailSender()
  const random = new FixedSecureRandom()
  const hasher = new FakePasswordHasher()
  const tokens = new FakeTokenService()
  const cfg = configService()

  const harness: AdminAuthHarness = {
    clock,
    admins,
    mail,
    random,
    hasher,
    tokens,
    login: new AdminLoginUseCase(admins, tokens, hasher, noopEvents),
    forgotPassword: new RequestAdminPasswordResetUseCase(
      admins,
      mail,
      random,
      clock,
      silentLogger,
      cfg
    ),
    resetPassword: new ResetAdminPasswordUseCase(admins, hasher, clock),
    changePassword: new ChangeAdminPasswordUseCase(admins, hasher),
    seedAdmin: async (input = {}) => {
      const admin = await Admin.create(
        {
          email: EmailAddress.create(input.email ?? 'admin@method-commerce.test'),
          password: PlainPassword.create(input.password ?? 'Secret123'),
          role: input.role ?? AdminRole.SuperAdmin,
          firstName: 'Ops',
          lastName: 'Admin',
        },
        hasher,
        clock.now()
      )

      if (input.active === false) {
        admin.updateDetails({ active: false })
      }

      return admins.save(admin)
    },
  }

  return harness
}
