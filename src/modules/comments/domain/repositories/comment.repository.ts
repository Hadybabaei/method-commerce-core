import { Comment } from '../entities/comment.aggregate'

export interface CommentRepository {
  findById(id: number): Promise<Comment | null>

  /** Inserts a new comment with its images. Comments are never updated in place aside from publish flags. */
  save(comment: Comment): Promise<Comment>

  /** Persists only the published flag (and emits drained events). */
  savePublication(comment: Comment): Promise<Comment>

  delete(comment: Comment): Promise<void>
}

export const COMMENT_REPOSITORY = Symbol('CommentRepository')
