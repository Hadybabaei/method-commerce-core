import { BaseDomainEvent } from '@shared/domain/domain-event'

export class CommentSubmittedEvent extends BaseDomainEvent<{
  commentId: number
  productId: number
  authorType: 'user' | 'admin'
}> {
  constructor(commentId: number, productId: number, authorType: 'user' | 'admin') {
    super('comments.submitted', { commentId, productId, authorType })
  }
}

export class CommentPublishedEvent extends BaseDomainEvent<{
  commentId: number
  productId: number
}> {
  constructor(commentId: number, productId: number) {
    super('comments.published', { commentId, productId })
  }
}

export class CommentUnpublishedEvent extends BaseDomainEvent<{
  commentId: number
  productId: number
}> {
  constructor(commentId: number, productId: number) {
    super('comments.unpublished', { commentId, productId })
  }
}

export class CommentDeletedEvent extends BaseDomainEvent<{ commentId: number; productId: number }> {
  constructor(commentId: number, productId: number) {
    super('comments.deleted', { commentId, productId })
  }
}
