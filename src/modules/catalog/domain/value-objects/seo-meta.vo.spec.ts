import { InvalidInputError } from '@shared/domain/errors'
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, SeoMeta } from './seo-meta.vo'

describe('SeoMeta', () => {
  it('collapses whitespace and turns blanks into null', () => {
    const seo = SeoMeta.create({ title: '  دریل   شارژی  ', description: '   ' })
    expect(seo.title).toBe('دریل شارژی')
    expect(seo.description).toBeNull()
  })

  it('enforces length limits', () => {
    expect(() => SeoMeta.create({ title: 'x'.repeat(SEO_TITLE_MAX + 1) })).toThrow(
      InvalidInputError
    )
    expect(() => SeoMeta.create({ description: 'x'.repeat(SEO_DESCRIPTION_MAX + 1) })).toThrow(
      InvalidInputError
    )
    expect(SeoMeta.create({ title: 'x'.repeat(SEO_TITLE_MAX) }).title).toHaveLength(SEO_TITLE_MAX)
  })

  it('merges only the fields that were sent', () => {
    const seo = SeoMeta.create({ title: 'A', description: 'B' })
    expect(seo.merge({ title: 'C' }).unpack()).toEqual({ title: 'C', description: 'B' })
    expect(seo.merge({ description: null }).unpack()).toEqual({ title: 'A', description: null })
    expect(seo.merge({}).equals(seo)).toBe(true)
  })
})
