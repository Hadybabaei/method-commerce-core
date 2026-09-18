import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { CommentAuthorView, CommentView, PaginatedCommentsView } from '../../application/dto/views'
import { CommentReadModel } from '../../application/ports/comment-read.port'

const authorInclude = {
  user: { include: { profile: true } },
  admin: true,
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.commentInclude

type CommentRecord = Prisma.commentGetPayload<{ include: typeof authorInclude }>

@Injectable()
export class PrismaCommentReadModel implements CommentReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<CommentView | null> {
    const record = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        ...authorInclude,
        replies: {
          include: authorInclude,
          orderBy: { created_at: 'asc' },
        },
      },
    })

    return record
      ? toCommentView(
          record,
          record.replies.map((reply) => toCommentView(reply))
        )
      : null
  }

  async listForProduct(input: {
    productId: number
    publishedOnly: boolean
    includeUnpublishedReplies: boolean
    limit: number
    offset: number
  }): Promise<PaginatedCommentsView> {
    const where: Prisma.commentWhereInput = {
      productId: input.productId,
      parentId: null,
      ...(input.publishedOnly ? { published: true } : {}),
    }

    const replyWhere = input.includeUnpublishedReplies
      ? {}
      : input.publishedOnly
        ? { published: true }
        : {}

    const [total, records] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: input.offset,
        take: input.limit,
        include: {
          ...authorInclude,
          replies: {
            where: replyWhere,
            include: authorInclude,
            orderBy: { created_at: 'asc' },
          },
        },
      }),
    ])

    return {
      items: records.map((record) =>
        toCommentView(
          record,
          record.replies.map((reply) => toCommentView(reply))
        )
      ),
      total,
      limit: input.limit,
      offset: input.offset,
    }
  }

  async listForUser(input: {
    userId: number
    limit: number
    offset: number
  }): Promise<PaginatedCommentsView> {
    const where: Prisma.commentWhereInput = { userId: input.userId }

    const [total, records] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: input.offset,
        take: input.limit,
        include: {
          ...authorInclude,
          replies: {
            include: authorInclude,
            orderBy: { created_at: 'asc' },
          },
        },
      }),
    ])

    return {
      items: records.map((record) =>
        toCommentView(
          record,
          record.replies.map((reply) => toCommentView(reply))
        )
      ),
      total,
      limit: input.limit,
      offset: input.offset,
    }
  }

  async listPending(input: { limit: number; offset: number }): Promise<PaginatedCommentsView> {
    const where: Prisma.commentWhereInput = { published: false }

    const [total, records] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip: input.offset,
        take: input.limit,
        include: {
          ...authorInclude,
          replies: {
            include: authorInclude,
            orderBy: { created_at: 'asc' },
          },
        },
      }),
    ])

    return {
      items: records.map((record) =>
        toCommentView(
          record,
          record.replies.map((reply) => toCommentView(reply))
        )
      ),
      total,
      limit: input.limit,
      offset: input.offset,
    }
  }
}

function toCommentView(record: CommentRecord, replies: CommentView[] = []): CommentView {
  return {
    id: record.id,
    productId: record.productId,
    title: record.title,
    content: record.content,
    rate: record.rate,
    published: record.published,
    parentId: record.parentId,
    author: toAuthorView(record),
    images: record.images.map((image) => ({ url: image.url, position: image.position })),
    createdAt: record.created_at,
    replies,
  }
}

function toAuthorView(record: CommentRecord): CommentAuthorView {
  if (record.admin) {
    const name = [record.admin.first_name, record.admin.last_name].filter(Boolean).join(' ')
    return {
      type: 'admin',
      id: record.admin.id,
      displayName: name || 'method-commerce',
      avatarUrl: record.admin.avatarUrl,
    }
  }

  const profile = record.user?.profile
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  return {
    type: 'user',
    id: record.userId!,
    displayName: name || maskPhone(record.user?.phone_number ?? ''),
    avatarUrl: record.user?.avatar ?? null,
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 7) {
    return 'کاربر'
  }
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`
}
