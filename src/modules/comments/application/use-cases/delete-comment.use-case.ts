import { Inject, Injectable } from '@nestjs/common'
import { OBJECT_STORAGE, ObjectStorage } from '@shared/application/ports/object-storage.port'
import { UseCase } from '@shared/application/use-case'
import { CommentNotFoundError } from '../../domain/errors/comments.errors'
import { COMMENT_REPOSITORY, CommentRepository } from '../../domain/repositories/comment.repository'
import { DeleteCommentCommand } from '../dto/views'

@Injectable()
export class DeleteCommentUseCase implements UseCase<DeleteCommentCommand, void> {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage
  ) {}

  async execute(command: DeleteCommentCommand): Promise<void> {
    const comment = await this.comments.findById(command.commentId)
    if (!comment) {
      throw new CommentNotFoundError(command.commentId)
    }

    if (command.userId !== undefined) {
      comment.ensureOwnedByUser(command.userId)
    }

    // Best-effort cleanup of disk files before the cascade removes the rows.
    for (const image of comment.images) {
      const relative = relativePathFromPublicUrl(image.url)
      if (relative) {
        await this.storage.delete(relative)
      }
    }

    comment.markDeleted()
    await this.comments.delete(comment)
  }
}

/**
 * Turns `http://host/uploads/comments/x.jpg` into `comments/x.jpg`.
 * Returns null when the URL is external or malformed — nothing to delete.
 */
function relativePathFromPublicUrl(publicUrl: string): string | null {
  const marker = '/uploads/'
  const index = publicUrl.indexOf(marker)
  if (index < 0) {
    return null
  }
  return publicUrl.slice(index + marker.length)
}
