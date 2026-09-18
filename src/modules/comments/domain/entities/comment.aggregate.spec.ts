import { InvalidInputError } from '@shared/domain/errors'
import { Comment } from './comment.aggregate'

describe('Comment', () => {
  it('creates a customer comment unpublished', () => {
    const comment = Comment.create({
      productId: 1,
      author: { type: 'user', userId: 4 },
      content: 'عالی بود',
      rate: 5,
      published: false,
    })

    expect(comment.published).toBe(false)
    expect(comment.rate).toBe(5)
    expect(comment.isReply).toBe(false)
  })

  it('drops the rating on a reply', () => {
    const comment = Comment.create({
      productId: 1,
      author: { type: 'admin', adminId: 1 },
      content: 'با تشکر',
      rate: 5,
      parentId: 9,
      published: true,
    })

    expect(comment.rate).toBeNull()
    expect(comment.isReply).toBe(true)
  })

  it('publishes and refuses a second publish', () => {
    const comment = Comment.fromPersistence(3, {
      productId: 1,
      author: { type: 'user', userId: 4 },
      title: null,
      content: 'عالی بود',
      rate: 4,
      parentId: null,
      published: false,
      images: [],
      createdAt: new Date(),
    })

    comment.publish()
    expect(comment.published).toBe(true)
    expect(() => comment.publish()).toThrow()
  })

  it('rejects empty content', () => {
    expect(() =>
      Comment.create({
        productId: 1,
        author: { type: 'user', userId: 4 },
        content: ' ',
        published: false,
      })
    ).toThrow(InvalidInputError)
  })
})
