import { Inject, Injectable } from '@nestjs/common'
import {
  ADMIN_REPOSITORY,
  AdminRepository,
} from '@modules/identity/domain/repositories/admin.repository'
import { AdminRecipientDirectory } from '../application/ports/admin-recipient.port'

@Injectable()
export class IdentityAdminRecipientDirectory implements AdminRecipientDirectory {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository) {}

  async listActiveIds(): Promise<number[]> {
    const admins = await this.admins.findAll()
    return admins.filter((admin) => admin.isActive).map((admin) => admin.id)
  }
}
