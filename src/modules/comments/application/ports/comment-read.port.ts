import { CommentView, PaginatedCommentsView } from '../dto/views'

export interface CommentReadModel {
  findById(id: number): Promise<CommentView | null>

  listForProduct(input: {
    productId: number
    publishedOnly: boolean
    includeUnpublishedReplies: boolean
    limit: number
    offset: number
  }): Promise<PaginatedCommentsView>

  listForUser(input: {
    userId: number
    limit: number
    offset: number
  }): Promise<PaginatedCommentsView>

  listPending(input: { limit: number; offset: number }): Promise<PaginatedCommentsView>
}

export const COMMENT_READ_MODEL = Symbol('CommentReadModel')
