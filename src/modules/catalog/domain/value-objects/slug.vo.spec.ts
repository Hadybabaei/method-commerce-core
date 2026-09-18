import { InvalidInputError } from '@shared/domain/errors'
import { Slug } from './slug.vo'

describe('Slug', () => {
  it('normalizes spacing, case and punctuation', () => {
    expect(Slug.create('  Power   Tools!  ').value).toBe('power-tools')
    expect(Slug.create('Bosch_GSB 13 RE').value).toBe('bosch-gsb-13-re')
  })

  it('keeps Persian letters instead of stripping them', () => {
    expect(Slug.create('ابزار برقی').value).toBe('ابزار-برقی')
  })

  it('rejects input that normalizes to nothing', () => {
    expect(() => Slug.create('!!!')).toThrow(InvalidInputError)
    expect(() => Slug.create('   ')).toThrow(InvalidInputError)
  })

  it('collapses and trims stray hyphens', () => {
    expect(Slug.create('--a---b--').value).toBe('a-b')
  })
})
