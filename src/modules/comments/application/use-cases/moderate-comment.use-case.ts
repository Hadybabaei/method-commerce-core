import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { CommentNotFoundError } from '../../domain/errors/comments.errors'
import { COMMENT_REPOSITORY, CommentRepository } from '../../domain/repositories/comment.repository'
import { CommentView, ModerateCommentCommand } from '../dto/views'
import { COMMENT_READ_MODEL, CommentReadModel } from '../ports/comment-read.port'

@Injectable()
export class ModerateCommentUseCase implements UseCase<ModerateCommentCommand, CommentView> {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(COMMENT_READ_MODEL) private readonly commentReads: CommentReadModel
  ) {}

  async execute(command: ModerateCommentCommand): Promise<CommentView> {
    const comment = await this.comments.findById(command.commentId)
    if (!comment) {
      throw new CommentNotFoundError(command.commentId)
    }

    if (command.published) {
      comment.publish()
    } else {
      comment.unpublish()
    }

    await this.comments.savePublication(comment)

    const view = await this.commentReads.findById(comment.id)
    if (!view) {
      throw new CommentNotFoundError(comment.id)
    }

    return view
  }
}
