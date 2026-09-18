import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Comment } from '../../domain/entities/comment.aggregate'
import { CommentRepository } from '../../domain/repositories/comment.repository'
import { toCommentWriteData, toDomainComment } from './mappers/comment.mapper'

const withImages = { images: { orderBy: { position: 'asc' as const } } }

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Comment | null> {
    const record = await this.prisma.comment.findUnique({
      where: { id },
      include: withImages,
    })

    return record ? toDomainComment(record) : null
  }

  async save(comment: Comment): Promise<Comment> {
    const data = toCommentWriteData(comment)
    const record = await this.prisma.comment.create({
      data,
      include: withImages,
    })

    const saved = toDomainComment(record)
    saved.announceCreated()
    await this.events.publish(saved.pullDomainEvents())

    return saved
  }

  async savePublication(comment: Comment): Promise<Comment> {
    const record = await this.prisma.comment.update({
      where: { id: comment.id },
      data: { published: comment.published },
      include: withImages,
    })

    await this.events.publish(comment.pullDomainEvents())

    return toDomainComment(record)
  }

  async delete(comment: Comment): Promise<void> {
    await this.prisma.comment.delete({ where: { id: comment.id } })
    await this.events.publish(comment.pullDomainEvents())
  }
}
