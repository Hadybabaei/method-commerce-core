import { Inject, Injectable } from '@nestjs/common'
import { ProductNotFoundError } from '@modules/catalog/domain/errors/catalog.errors'
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '@modules/catalog/domain/repositories/product.repository'
import { InvalidInputError } from '@shared/domain/errors'
import { UseCase } from '@shared/application/use-case'
import {
  ListPendingCommentsQuery,
  ListProductCommentsQuery,
  ListUserCommentsQuery,
  PaginatedCommentsView,
} from '../dto/views'
import { COMMENT_READ_MODEL, CommentReadModel } from '../ports/comment-read.port'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

@Injectable()
export class ListProductCommentsUseCase implements UseCase<
  ListProductCommentsQuery,
  PaginatedCommentsView
> {
  constructor(
    @Inject(COMMENT_READ_MODEL) private readonly commentReads: CommentReadModel,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository
  ) {}

  async execute(query: ListProductCommentsQuery): Promise<PaginatedCommentsView> {
    const productId = await this.resolveProductId(query)

    return this.commentReads.listForProduct({
      productId,
      publishedOnly: query.publishedOnly,
      includeUnpublishedReplies: query.includeUnpublishedReplies,
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
    })
  }

  private async resolveProductId(query: ListProductCommentsQuery): Promise<number> {
    if (query.productId) {
      const product = await this.products.findById(query.productId)
      if (!product || (query.publishedOnly && !product.published)) {
        throw new ProductNotFoundError(query.productId)
      }
      return product.id
    }

    if (query.productSlug) {
      const product = await this.products.findBySlug(query.productSlug)
      if (!product || (query.publishedOnly && !product.published)) {
        throw new ProductNotFoundError(query.productSlug)
      }
      return product.id
    }

    throw new InvalidInputError('A product id or slug is required')
  }
}

@Injectable()
export class ListUserCommentsUseCase implements UseCase<
  ListUserCommentsQuery,
  PaginatedCommentsView
> {
  constructor(@Inject(COMMENT_READ_MODEL) private readonly commentReads: CommentReadModel) {}

  execute(query: ListUserCommentsQuery): Promise<PaginatedCommentsView> {
    return this.commentReads.listForUser({
      userId: query.userId,
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
    })
  }
}

@Injectable()
export class ListPendingCommentsUseCase implements UseCase<
  ListPendingCommentsQuery,
  PaginatedCommentsView
> {
  constructor(@Inject(COMMENT_READ_MODEL) private readonly commentReads: CommentReadModel) {}

  execute(query: ListPendingCommentsQuery): Promise<PaginatedCommentsView> {
    return this.commentReads.listPending({
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
    })
  }
}

function clampLimit(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidInputError('limit must be a positive integer')
  }
  return Math.min(limit, MAX_LIMIT)
}

function clampOffset(offset?: number): number {
  if (offset === undefined) {
    return 0
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidInputError('offset must be a non-negative integer')
  }
  return offset
}
