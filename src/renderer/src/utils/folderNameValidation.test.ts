import { describe, expect, it } from 'vitest'
import { splitFolderPath, validateFolderNameBase } from './folderNameValidation'

describe('splitFolderPath', () => {
  it('splits the parent prefix from the final segment', () => {
    expect(splitFolderPath('/root/sub/leaf')).toEqual({ dirPrefix: '/root/sub/', base: 'leaf' })
  })

  it('treats a path with no separator as having no prefix', () => {
    expect(splitFolderPath('leaf')).toEqual({ dirPrefix: '', base: 'leaf' })
  })
})

describe('validateFolderNameBase', () => {
  it('rejects an empty or whitespace-only name', () => {
    expect(validateFolderNameBase('')).toBe('Name cannot be empty')
    expect(validateFolderNameBase('  ')).toBe('Name cannot be empty')
  })

  it('rejects names with invalid characters', () => {
    expect(validateFolderNameBase('a*b')).toBe('Contains invalid characters')
  })

  it('accepts a valid name', () => {
    expect(validateFolderNameBase('2024 Vacation')).toBeNull()
  })
})
