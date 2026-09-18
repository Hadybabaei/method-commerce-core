import { comment, comment_image } from '@prisma/client'
import { Comment, CommentAuthor } from '../../../domain/entities/comment.aggregate'
import { CommentImage } from '../../../domain/value-objects/comment-image.vo'

export type CommentRecord = comment & { images: comment_image[] }

export function toDomainComment(record: CommentRecord): Comment {
  const author: CommentAuthor = record.adminId
    ? { type: 'admin', adminId: record.adminId }
    : { type: 'user', userId: record.userId! }

  return Comment.fromPersistence(record.id, {
    productId: record.productId,
    author,
    title: record.title,
    content: record.content,
    rate: record.rate,
    parentId: record.parentId,
    published: record.published,
    images: record.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image) => CommentImage.create(image.url, image.position)),
    createdAt: record.created_at,
  })
}

export function toCommentWriteData(commentAggregate: Comment) {
  return {
    productId: commentAggregate.productId,
    title: commentAggregate.title,
    content: commentAggregate.content,
    rate: commentAggregate.rate,
    parentId: commentAggregate.parentId,
    published: commentAggregate.published,
    userId: commentAggregate.author.type === 'user' ? commentAggregate.author.userId : null,
    adminId: commentAggregate.author.type === 'admin' ? commentAggregate.author.adminId : null,
    images: {
      create: commentAggregate.images.map((image) => ({
        url: image.url,
        position: image.position,
      })),
    },
  }
}
