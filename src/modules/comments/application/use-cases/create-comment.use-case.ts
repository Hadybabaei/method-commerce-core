import { Inject, Injectable } from '@nestjs/common'
import { ProductNotFoundError } from '@modules/catalog/domain/errors/catalog.errors'
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '@modules/catalog/domain/repositories/product.repository'
import { IMAGE_UPLOADER, ImageUploader } from '@shared/application/ports/image-uploader.port'
import { UseCase } from '@shared/application/use-case'
import { Comment } from '../../domain/entities/comment.aggregate'
import {
  CommentProductMismatchError,
  CommentTooDeepError,
  CommentNotFoundError,
} from '../../domain/errors/comments.errors'
import { COMMENT_REPOSITORY, CommentRepository } from '../../domain/repositories/comment.repository'
import { CommentImage } from '../../domain/value-objects/comment-image.vo'
import { CreateCommentCommand, CommentView } from '../dto/views'
import { COMMENT_READ_MODEL, CommentReadModel } from '../ports/comment-read.port'

export interface CreateCommentWithFilesCommand extends Omit<CreateCommentCommand, 'imageUrls'> {
  files?: ReadonlyArray<{ buffer: Buffer; mimeType: string; originalName: string }>
}

@Injectable()
export class CreateCommentUseCase implements UseCase<CreateCommentWithFilesCommand, CommentView> {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(COMMENT_READ_MODEL) private readonly commentReads: CommentReadModel,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(IMAGE_UPLOADER) private readonly images: ImageUploader
  ) {}

  async execute(command: CreateCommentWithFilesCommand): Promise<CommentView> {
    const product = await this.products.findById(command.productId)
    if (!product || (command.author.type === 'user' && !product.published)) {
      throw new ProductNotFoundError(command.productId)
    }

    let parent: Comment | null = null
    if (command.parentId) {
      parent = await this.comments.findById(command.parentId)
      if (!parent) {
        throw new CommentNotFoundError(command.parentId)
      }
      if (parent.productId !== command.productId) {
        throw new CommentProductMismatchError()
      }
      if (parent.isReply) {
        throw new CommentTooDeepError()
      }
      // Customers may only reply to comments that are already visible.
      if (command.author.type === 'user' && !parent.published) {
        throw new CommentNotFoundError(command.parentId)
      }
    }

    const uploaded = await this.images.uploadImages(command.files ?? [], 'comments')
    const imageVos = uploaded.map((object, index) => CommentImage.create(object.publicUrl, index))

    const published = command.author.type === 'admin'
    const comment = Comment.create({
      productId: command.productId,
      author: command.author,
      title: command.title,
      content: command.content,
      rate: command.rate,
      parentId: command.parentId ?? null,
      images: imageVos,
      published,
    })

    const saved = await this.comments.save(comment)
    const view = await this.commentReads.findById(saved.id)
    if (!view) {
      throw new CommentNotFoundError(saved.id)
    }

    return view
  }
}
