import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { AuditLog } from '../application/backoffice.ports'

@Injectable()
export class PrismaAuditLog implements AuditLog {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    adminId: number | null
    action: string
    entity: string
    entityId: string | null
    payload: unknown
    status: number
  }): Promise<void> {
    await this.prisma.admin_audit_log.create({
      data: {
        adminId: entry.adminId,
        action: entry.action.slice(0, 191),
        entity: entry.entity.slice(0, 64),
        entityId: entry.entityId?.slice(0, 64) ?? null,
        payload:
          entry.payload === undefined || entry.payload === null
            ? Prisma.DbNull
            : (entry.payload as Prisma.InputJsonValue),
        status: entry.status,
      },
    })
  }

  async list(query: {
    adminId?: number
    entity?: string
    entityId?: string
    limit: number
    offset: number
  }) {
    const where: Prisma.admin_audit_logWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.admin_audit_log.count({ where }),
      this.prisma.admin_audit_log.findMany({
        where,
        include: { admin: { select: { email: true } } },
        orderBy: { id: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ])
    return {
      items: rows.map((row) => ({
        id: row.id,
        adminId: row.adminId,
        adminEmail: row.admin?.email ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        payload: row.payload,
        status: row.status,
        createdAt: row.created_at,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }
}
