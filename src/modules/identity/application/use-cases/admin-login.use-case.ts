import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { UseCase } from '@shared/application/use-case'
import { PASSWORD_HASHER, PasswordHasher } from '@shared/domain/services/password-hasher'
import { InvalidCredentialsError } from '../../domain/errors/identity.errors'
import { AdminAuthenticatedEvent } from '../../domain/events/identity.events'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { AdminLoginCommand } from '../dto/commands'
import { AuthenticatedAdminView } from '../dto/views'
import { toAdminView } from '../mappers/identity-view.mapper'

@Injectable()
export class AdminLoginUseCase implements UseCase<AdminLoginCommand, AuthenticatedAdminView> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async execute({ email, password }: AdminLoginCommand): Promise<AuthenticatedAdminView> {
    const admin = await this.admins.findByEmail(EmailAddress.create(email))

    // Unknown email reports the same error as a wrong password so the endpoint
    // cannot be used to enumerate accounts.
    if (!admin) {
      throw new InvalidCredentialsError()
    }

    await admin.authenticate(password, this.hasher)

    const accessToken = await this.tokenService.signAccessToken({
      sub: admin.id,
      role: admin.role as string,
      audience: 'admin',
      email: admin.email.value,
      phoneNumber: admin.phoneNumber ?? undefined,
    })

    // Signing in changes no state, so there is nothing to save and the event is
    // announced from here rather than by the repository.
    await this.events.publish([new AdminAuthenticatedEvent(admin.id, admin.email.value)])

    return { accessToken, admin: toAdminView(admin) }
  }
}
