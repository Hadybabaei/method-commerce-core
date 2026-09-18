import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { AddressView } from '../../application/dto/views'
import { AddressReadModel } from '../../application/ports/address-read.port'
import { toAddressView } from './mappers/address.mapper'

@Injectable()
export class PrismaAddressReadModel implements AddressReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findById(addressId: number): Promise<AddressView | null> {
    const record = await this.prisma.user_address.findUnique({
      where: { id: addressId },
      include: { province: true, city: true },
    })

    return record ? toAddressView(record) : null
  }

  async listByUserId(userId: number): Promise<AddressView[]> {
    const records = await this.prisma.user_address.findMany({
      where: { userId },
      include: { province: true, city: true },
      orderBy: { id: 'desc' },
    })

    return records.map(toAddressView)
  }
}
