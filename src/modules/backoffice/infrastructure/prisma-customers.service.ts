import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  USER_REPOSITORY,
  UserRepository,
} from '@modules/identity/domain/repositories/user.repository'
import { NotFoundError } from '@shared/domain/errors'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  CustomerDetailView,
  CustomerSummaryView,
  CustomersService,
} from '../application/backoffice.ports'

const fullName = (profile: { first_name: string | null; last_name: string | null } | null) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null

/** Paid, not cancelled orders count towards what a customer has spent. */
const SPENT_WHERE: Prisma.orderWhereInput = { paidAt: { not: null }, status: { not: 'CANCELLED' } }

@Injectable()
export class PrismaCustomersService implements CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository
  ) {}

  async list(query: { search?: string; limit: number; offset: number }) {
    const search = query.search?.trim()
    const where: Prisma.userWhereInput = search
      ? {
          OR: [
            { phone_number: { contains: search, mode: 'insensitive' } },
            { profile: { first_name: { contains: search, mode: 'insensitive' } } },
            { profile: { last_name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { profile: { select: { first_name: true, last_name: true } } },
        orderBy: { id: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ])

    const stats = await this.statsFor(users.map((user) => user.id))
    const items: CustomerSummaryView[] = users.map((user) => ({
      id: user.id,
      phoneNumber: user.phone_number,
      name: fullName(user.profile),
      createdAt: user.created_at,
      blockedAt: user.blocked_at,
      ...(stats.get(user.id) ?? { orders: 0, totalSpent: 0 }),
    }))
    return { items, total, limit: query.limit, offset: query.offset }
  }

  async get(id: number): Promise<CustomerDetailView> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: { select: { first_name: true, last_name: true } } },
    })
    if (!user) {
      throw new NotFoundError('Customer not found', { customer: id })
    }
    const [stats, recent] = await Promise.all([
      this.statsFor([id]),
      this.prisma.order.findMany({
        where: { userId: id },
        select: { id: true, number: true, status: true, total: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ])

    return {
      id: user.id,
      phoneNumber: user.phone_number,
      name: fullName(user.profile),
      email: user.email,
      createdAt: user.created_at,
      blockedAt: user.blocked_at,
      ...(stats.get(id) ?? { orders: 0, totalSpent: 0 }),
      recentOrders: recent.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        createdAt: order.created_at,
      })),
    }
  }

  async setBlocked(id: number, blocked: boolean, now: Date): Promise<CustomerDetailView> {
    const user = await this.users.findById(id)
    if (!user) {
      throw new NotFoundError('Customer not found', { customer: id })
    }
    if (blocked) {
      user.block(now)
    } else {
      user.unblock()
    }
    await this.users.save(user)
    return this.get(id)
  }

  private async statsFor(userIds: number[]) {
    const stats = new Map<number, { orders: number; totalSpent: number }>()
    if (userIds.length === 0) return stats

    const [counts, spent] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, ...SPENT_WHERE },
        _sum: { total: true, refundedTotal: true },
      }),
    ])
    for (const row of counts) {
      stats.set(row.userId, { orders: row._count._all, totalSpent: 0 })
    }
    for (const row of spent) {
      const entry = stats.get(row.userId) ?? { orders: 0, totalSpent: 0 }
      entry.totalSpent = (row._sum.total ?? 0) - (row._sum.refundedTotal ?? 0)
      stats.set(row.userId, entry)
    }
    return stats
  }
}
