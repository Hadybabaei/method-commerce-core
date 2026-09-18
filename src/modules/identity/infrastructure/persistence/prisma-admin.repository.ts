import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Admin } from '../../domain/entities/admin.aggregate'
import { AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { AdminRecord, toAdminWriteData, toDomainAdmin } from './mappers/admin.mapper'

@Injectable()
export class PrismaAdminRepository implements AdminRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Admin | null> {
    const record = await this.prisma.admin.findUnique({ where: { id } })

    return record ? toDomainAdmin(record) : null
  }

  async findByEmail(email: EmailAddress): Promise<Admin | null> {
    const record = await this.prisma.admin.findUnique({ where: { email: email.value } })

    return record ? toDomainAdmin(record) : null
  }

  async findAll(): Promise<Admin[]> {
    const records = await this.prisma.admin.findMany({ orderBy: { created_at: 'desc' } })

    return records.map(toDomainAdmin)
  }

  async save(admin: Admin): Promise<Admin> {
    const record = admin.isNew ? await this.insert(admin) : await this.update(admin)

    // Published only once the write succeeded.
    await this.events.publish(admin.pullDomainEvents())

    return toDomainAdmin(record)
  }

  async delete(id: number): Promise<void> {
    await this.prisma.admin.delete({ where: { id } })
  }

  private insert(admin: Admin): Promise<AdminRecord> {
    return this.prisma.admin.create({ data: toAdminWriteData(admin) })
  }

  private update(admin: Admin): Promise<AdminRecord> {
    return this.prisma.admin.update({ where: { id: admin.id }, data: toAdminWriteData(admin) })
  }
}
