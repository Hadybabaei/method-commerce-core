import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { User } from '../../domain/entities/user.aggregate'
import { UserRepository } from '../../domain/repositories/user.repository'
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo'
import {
  toDomainUser,
  toUserProfileWriteData,
  toUserWriteData,
  UserRecord,
} from './mappers/user.mapper'

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    })

    return record ? toDomainUser(record) : null
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { phone_number: phoneNumber.value },
      include: { profile: true },
    })

    return record ? toDomainUser(record) : null
  }

  async existsByPhoneNumber(phoneNumber: PhoneNumber): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { phone_number: phoneNumber.value },
    })

    return count > 0
  }

  async save(user: User): Promise<User> {
    const record = user.isNew ? await this.insert(user) : await this.update(user)

    // Published only once the write succeeded.
    await this.events.publish(user.pullDomainEvents())

    return toDomainUser(record)
  }

  private insert(user: User): Promise<UserRecord> {
    const profile = user.profile

    return this.prisma.user.create({
      data: {
        ...toUserWriteData(user),
        ...(profile ? { profile: { create: toUserProfileWriteData(profile) } } : {}),
      },
      include: { profile: true },
    })
  }

  private update(user: User): Promise<UserRecord> {
    const profile = user.profile
    const profileData = profile ? toUserProfileWriteData(profile) : null

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...toUserWriteData(user),
        // The profile is part of this aggregate, so it is written in the same
        // statement as the root rather than through its own repository.
        ...(profileData
          ? { profile: { upsert: { create: profileData, update: profileData } } }
          : {}),
      },
      include: { profile: true },
    })
  }
}
