import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import {
  CommentAlreadyHiddenError,
  CommentAlreadyPublishedError,
  CommentNotOwnedError,
  TooManyCommentImagesError,
} from '../errors/comments.errors'
import {
  CommentDeletedEvent,
  CommentPublishedEvent,
  CommentSubmittedEvent,
  CommentUnpublishedEvent,
} from '../events/comments.events'
import { CommentImage } from '../value-objects/comment-image.vo'

export const MAX_COMMENT_IMAGES = 5
export const MAX_COMMENT_CONTENT_LENGTH = 5_000
export const MAX_COMMENT_TITLE_LENGTH = 200

export type CommentAuthor = { type: 'user'; userId: number } | { type: 'admin'; adminId: number }

export interface CommentProps {
  productId: number
  author: CommentAuthor
  title: string | null
  content: string
  rate: number | null
  parentId: number | null
  published: boolean
  images: CommentImage[]
  createdAt: Date
}

export interface CreateCommentInput {
  productId: number
  author: CommentAuthor
  title?: string | null
  content: string
  rate?: number | null
  parentId?: number | null
  images?: CommentImage[]
  /** Admins publish immediately; customers wait for approval. */
  published: boolean
}

/**
 * A product comment or a one-level reply. Depth rules live in the use case
 * (needs the parent loaded); this aggregate owns authorship, publication and
 * the image list.
 */
export class Comment extends AggregateRoot {
  private props: CommentProps

  private constructor(id: number, props: CommentProps) {
    super(id)
    this.props = props
  }

  static create(input: CreateCommentInput): Comment {
    Comment.assertContent(input.content)
    const title = Comment.normalizeTitle(input.title)
    const rate = input.parentId ? null : Comment.normalizeRate(input.rate)
    const images = input.images ?? []
    Comment.assertImages(images)

    if (!Number.isInteger(input.productId) || input.productId <= 0) {
      throw new InvalidInputError('A comment needs a product')
    }

    const comment = new Comment(UNSAVED_ID, {
      productId: input.productId,
      author: input.author,
      title,
      content: input.content.trim(),
      rate,
      parentId: input.parentId ?? null,
      published: input.published,
      images,
      createdAt: new Date(),
    })

    return comment
  }

  static fromPersistence(id: number, props: CommentProps): Comment {
    return new Comment(id, props)
  }

  /**
   * Call after insert so the event carries the real id. Customer submissions
   * stay unpublished until `publish()`; admin ones are already live.
   */
  announceCreated(): void {
    this.addDomainEvent(
      new CommentSubmittedEvent(this.id, this.props.productId, this.props.author.type)
    )
    if (this.props.published) {
      this.addDomainEvent(new CommentPublishedEvent(this.id, this.props.productId))
    }
  }

  publish(): void {
    if (this.props.published) {
      throw new CommentAlreadyPublishedError(this.id)
    }
    this.props.published = true
    this.addDomainEvent(new CommentPublishedEvent(this.id, this.props.productId))
  }

  unpublish(): void {
    if (!this.props.published) {
      throw new CommentAlreadyHiddenError(this.id)
    }
    this.props.published = false
    this.addDomainEvent(new CommentUnpublishedEvent(this.id, this.props.productId))
  }

  markDeleted(): void {
    this.addDomainEvent(new CommentDeletedEvent(this.id, this.props.productId))
  }

  ensureOwnedByUser(userId: number): void {
    if (this.props.author.type !== 'user' || this.props.author.userId !== userId) {
      throw new CommentNotOwnedError()
    }
  }

  get productId(): number {
    return this.props.productId
  }

  get author(): CommentAuthor {
    return this.props.author
  }

  get title(): string | null {
    return this.props.title
  }

  get content(): string {
    return this.props.content
  }

  get rate(): number | null {
    return this.props.rate
  }

  get parentId(): number | null {
    return this.props.parentId
  }

  get published(): boolean {
    return this.props.published
  }

  get images(): readonly CommentImage[] {
    return this.props.images
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get isReply(): boolean {
    return this.props.parentId !== null
  }

  private static assertContent(content: string): void {
    const trimmed = content?.trim() ?? ''
    if (trimmed.length < 2) {
      throw new InvalidInputError('Comment text must be at least 2 characters')
    }
    if (trimmed.length > MAX_COMMENT_CONTENT_LENGTH) {
      throw new InvalidInputError(
        `Comment text must be at most ${MAX_COMMENT_CONTENT_LENGTH} characters`
      )
    }
  }

  private static normalizeTitle(title: string | null | undefined): string | null {
    if (title === undefined || title === null) {
      return null
    }
    const trimmed = title.trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.length > MAX_COMMENT_TITLE_LENGTH) {
      throw new InvalidInputError(
        `Comment title must be at most ${MAX_COMMENT_TITLE_LENGTH} characters`
      )
    }
    return trimmed
  }

  private static normalizeRate(rate: number | null | undefined): number | null {
    if (rate === undefined || rate === null) {
      return null
    }
    if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
      throw new InvalidInputError('Rating must be an integer from 1 to 5')
    }
    return rate
  }

  private static assertImages(images: CommentImage[]): void {
    if (images.length > MAX_COMMENT_IMAGES) {
      throw new TooManyCommentImagesError(MAX_COMMENT_IMAGES)
    }
  }
}
