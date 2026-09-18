export interface CommentAuthorView {
  type: 'user' | 'admin'
  id: number
  displayName: string
  avatarUrl: string | null
}

export interface CommentImageView {
  url: string
  position: number
}

export interface CommentView {
  id: number
  productId: number
  title: string | null
  content: string
  rate: number | null
  published: boolean
  parentId: number | null
  author: CommentAuthorView
  images: CommentImageView[]
  createdAt: Date
  replies: CommentView[]
}

export interface PaginatedCommentsView {
  items: CommentView[]
  total: number
  limit: number
  offset: number
}

export interface CreateCommentCommand {
  productId: number
  author: { type: 'user'; userId: number } | { type: 'admin'; adminId: number }
  title?: string | null
  content: string
  rate?: number | null
  parentId?: number | null
  /** Already-uploaded public URLs, in order. */
  imageUrls?: string[]
}

export interface ModerateCommentCommand {
  commentId: number
  published: boolean
}

export interface DeleteCommentCommand {
  commentId: number
  /** When set, the comment must belong to this customer. */
  userId?: number
}

export interface ListProductCommentsQuery {
  productId?: number
  productSlug?: string
  publishedOnly: boolean
  /** When true, include unpublished replies under a published parent (admin). */
  includeUnpublishedReplies: boolean
  limit?: number
  offset?: number
}

export interface ListUserCommentsQuery {
  userId: number
  limit?: number
  offset?: number
}

export interface ListPendingCommentsQuery {
  limit?: number
  offset?: number
}
