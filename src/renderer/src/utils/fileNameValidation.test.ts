import { describe, expect, it } from 'vitest'

import { splitFileName, validateFileNameBase } from './fileNameValidation'

describe('splitFileName', () => {
  it('splits base and extension at the last dot', () => {
    expect(splitFileName('photo.jpg')).toEqual({ base: 'photo', extension: '.jpg' })
  })

  it('keeps the whole name as base when there is no extension', () => {
    expect(splitFileName('photo')).toEqual({ base: 'photo', extension: '' })
  })

  it('treats a leading dot (dotfile) as having no extension', () => {
    expect(splitFileName('.gitignore')).toEqual({ base: '.gitignore', extension: '' })
  })

  it('splits at the last dot for multi-dot names', () => {
    expect(splitFileName('archive.tar.gz')).toEqual({ base: 'archive.tar', extension: '.gz' })
  })
})

describe('validateFileNameBase', () => {
  it('rejects an empty or whitespace-only name', () => {
    expect(validateFileNameBase('')).toBe('Name cannot be empty')
    expect(validateFileNameBase('   ')).toBe('Name cannot be empty')
  })

  it('rejects names with invalid characters', () => {
    expect(validateFileNameBase('a/b')).toBe('Contains invalid characters')
    expect(validateFileNameBase('a:b')).toBe('Contains invalid characters')
  })

  it('accepts a valid name', () => {
    expect(validateFileNameBase('vacation-photo')).toBeNull()
  })
})
