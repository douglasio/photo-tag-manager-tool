import { describe, expect, it } from 'vitest'

import type { PhotoMetadata } from '@shared/types'

import {
  DATE_TAKEN_FORMAT,
  formatCamera,
  formatDateModified,
  formatDateTaken,
  formatDateWithRelative,
  toDisplayMetadata
} from './metadataDisplay'

describe('formatDateWithRelative', () => {
  it('pairs the absolute date with a relative age', () => {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const result = formatDateWithRelative(twoYearsAgo.toISOString())

    expect(result).toContain('2 years ago')
    expect(result).toContain(String(twoYearsAgo.getFullYear()))
  })

  // Null (not the '—' placeholder) so the caller drops the whole row rather
  // than rendering a dash next to a calendar icon.
  it('returns null for a missing or unparseable date', () => {
    expect(formatDateWithRelative(null)).toBeNull()
    expect(formatDateWithRelative('not a date')).toBeNull()
  })
})

describe('formatCamera', () => {
  it('joins make and model when the model does not already name the make', () => {
    expect(formatCamera('Canon', 'EOS 5D')).toBe('Canon EOS 5D')
  })

  // Most cameras write the brand into the model too, so joining blindly gives
  // "NIKON NIKON D3300".
  it('drops a redundant make already embedded in the model', () => {
    expect(formatCamera('NIKON', 'NIKON D3300')).toBe('NIKON D3300')
    expect(formatCamera('Canon', 'canon eos 5d')).toBe('canon eos 5d')
  })

  it('falls back to whichever half is known', () => {
    expect(formatCamera(null, 'EOS 5D')).toBe('EOS 5D')
    expect(formatCamera('Canon', null)).toBe('Canon')
  })

  it('returns null when neither is usable', () => {
    expect(formatCamera(null, null)).toBeNull()
    expect(formatCamera('  ', '')).toBeNull()
  })
})

describe('formatDateTaken', () => {
  it('formats a valid ISO date using DATE_TAKEN_FORMAT', () => {
    const result = formatDateTaken('2024-03-05T14:30:00')
    expect(result).toMatch(/Mar 5, 2024/)
  })

  it('returns the placeholder for null', () => {
    expect(formatDateTaken(null)).toBe('—')
  })

  it('returns the placeholder for an unparsable string', () => {
    expect(formatDateTaken('not-a-date')).toBe('—')
  })
})

describe('formatDateModified', () => {
  it('formats a valid epoch-ms mtime using the same style as formatDateTaken', () => {
    const result = formatDateModified(new Date('2024-03-05T14:30:00').getTime())
    expect(result).toMatch(/Mar 5, 2024/)
  })

  it('returns the placeholder for null', () => {
    expect(formatDateModified(null)).toBe('—')
  })

  it('returns the placeholder for undefined', () => {
    expect(formatDateModified(undefined)).toBe('—')
  })
})

describe('toDisplayMetadata', () => {
  const metadata: PhotoMetadata = {
    dateTaken: '2024-03-05T14:30:00',
    cameraMake: 'Canon',
    cameraModel: null,
    widthPx: 4000,
    heightPx: null,
    fileSizeBytes: 2_500_000,
    format: 'JPEG',
    comment: null
  }

  it('formats each field with a label and display value', () => {
    const display = toDisplayMetadata(metadata)

    expect(display.dateTaken.label).toBe('Date Taken')
    expect(display.dateTaken.displayValue).toContain(DATE_TAKEN_FORMAT.includes('MMM') ? 'Mar' : '')
    expect(display.cameraMake.displayValue).toBe('Canon')
    expect(display.cameraModel.displayValue).toBe('—')
    expect(display.widthPx.displayValue).toBe('4,000 px')
    expect(display.heightPx.displayValue).toBe('—')
    expect(display.format.displayValue).toBe('JPEG')
    expect(display.comment.displayValue).toBe('—')
  })

  it('formats file size in the appropriate unit', () => {
    const display = toDisplayMetadata({ ...metadata, fileSizeBytes: 500 })
    expect(display.fileSizeBytes.displayValue).toBe('500 B')

    const displayMb = toDisplayMetadata({ ...metadata, fileSizeBytes: 2_500_000 })
    expect(displayMb.fileSizeBytes.displayValue).toMatch(/MB$/)
  })

  it('preserves the raw value alongside the formatted one', () => {
    const display = toDisplayMetadata(metadata)
    expect(display.widthPx.value).toBe(4000)
  })
})
