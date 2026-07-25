import { describe, expect, it } from 'vitest'
import { DATE_TAKEN_FORMAT, formatDateTaken, toDisplayMetadata } from './metadataDisplay'
import type { PhotoMetadata } from '../../../shared/types'

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
