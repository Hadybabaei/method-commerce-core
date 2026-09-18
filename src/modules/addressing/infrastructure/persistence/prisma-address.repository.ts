import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Address } from '../../domain/entities/address.aggregate'
import { AddressRepository } from '../../domain/repositories/address.repository'
import { AddressRecord, toAddressWriteData, toDomainAddress } from './mappers/address.mapper'

@Injectable()
export class PrismaAddressRepository implements AddressRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Address | null> {
    const record = await this.prisma.user_address.findUnique({ where: { id } })

    return record ? toDomainAddress(record) : null
  }

  async findAllByUserId(userId: number): Promise<Address[]> {
    const records = await this.prisma.user_address.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
    })

    return records.map(toDomainAddress)
  }

  countByUserId(userId: number): Promise<number> {
    return this.prisma.user_address.count({ where: { userId } })
  }

  async save(address: Address): Promise<Address> {
    const record = address.isNew ? await this.insert(address) : await this.update(address)

    // Published only once the write succeeded.
    await this.events.publish(address.pullDomainEvents())

    return toDomainAddress(record)
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user_address.delete({ where: { id } })
  }

  private insert(address: Address): Promise<AddressRecord> {
    return this.prisma.user_address.create({ data: toAddressWriteData(address) })
  }

  private update(address: Address): Promise<AddressRecord> {
    const { userId: _userId, ...data } = toAddressWriteData(address)

    // The owner is fixed at creation time and is never part of an update.
    return this.prisma.user_address.update({ where: { id: address.id }, data })
  }
}
