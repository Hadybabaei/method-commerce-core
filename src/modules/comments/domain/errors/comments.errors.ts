import {
  BusinessRuleViolationError,
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
} from '@shared/domain/errors'

export class CommentNotFoundError extends NotFoundError {
  constructor(identifier?: number) {
    super('Comment not found', identifier === undefined ? undefined : { comment: identifier })
  }
}

export class CommentNotOwnedError extends ForbiddenError {
  constructor() {
    super('You do not own this comment')
  }
}

export class CommentAlreadyPublishedError extends ConflictError {
  constructor(commentId: number) {
    super('That comment is already published', { comment: commentId })
  }
}

export class CommentAlreadyHiddenError extends ConflictError {
  constructor(commentId: number) {
    super('That comment is already hidden', { comment: commentId })
  }
}

/** Replies are one level deep: a reply cannot itself have replies. */
export class CommentTooDeepError extends BusinessRuleViolationError {
  constructor() {
    super('Replies cannot themselves have replies')
  }
}

export class CommentProductMismatchError extends BusinessRuleViolationError {
  constructor() {
    super('A reply must belong to the same product as its parent')
  }
}

export class TooManyCommentImagesError extends InvalidInputError {
  constructor(max: number) {
    super(`A comment may include at most ${max} images`, { max })
  }
}
