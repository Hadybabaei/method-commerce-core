import { Module } from '@nestjs/common'
import { CatalogModule } from '@modules/catalog/catalog.module'
import { IdentityModule } from '@modules/identity/identity.module'
import { COMMENT_READ_MODEL } from './application/ports/comment-read.port'
import { CreateCommentUseCase } from './application/use-cases/create-comment.use-case'
import { DeleteCommentUseCase } from './application/use-cases/delete-comment.use-case'
import {
  ListPendingCommentsUseCase,
  ListProductCommentsUseCase,
  ListUserCommentsUseCase,
} from './application/use-cases/list-comments.use-case'
import { ModerateCommentUseCase } from './application/use-cases/moderate-comment.use-case'
import { COMMENT_REPOSITORY } from './domain/repositories/comment.repository'
import { PrismaCommentReadModel } from './infrastructure/persistence/prisma-comment-read.model'
import { PrismaCommentRepository } from './infrastructure/persistence/prisma-comment.repository'
import { AdminCommentsController } from './presentation/controllers/admin-comments.controller'
import { CustomerCommentsController } from './presentation/controllers/customer-comments.controller'
import { ProductCommentsController } from './presentation/controllers/product-comments.controller'
import { CommentImagesInterceptor } from './presentation/interceptors/comment-images.interceptor'

const useCases = [
  CreateCommentUseCase,
  ModerateCommentUseCase,
  DeleteCommentUseCase,
  ListProductCommentsUseCase,
  ListUserCommentsUseCase,
  ListPendingCommentsUseCase,
]

/**
 * Comments bounded context: product discussion with one-level replies,
 * moderation for customer posts, and image uploads.
 */
@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [ProductCommentsController, CustomerCommentsController, AdminCommentsController],
  providers: [
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
    { provide: COMMENT_READ_MODEL, useClass: PrismaCommentReadModel },
    CommentImagesInterceptor,
    ...useCases,
  ],
})
export class CommentsModule {}
