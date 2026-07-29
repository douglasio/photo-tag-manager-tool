import dayjs from 'dayjs'
import type { PhotoMetadata } from '../../../shared/types'

interface MetadataField<T> {
  label: string
  value: T
  displayValue: string
}

export type DisplayMetadata = {
  [K in keyof PhotoMetadata]: MetadataField<PhotoMetadata[K]>
}

const NONE_DISPLAY = '—'

function field<T>(label: string, value: T, format: (value: T) => string): MetadataField<T> {
  return { label, value, displayValue: format(value) }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`
}

function formatPixels(value: number | null): string {
  return value !== null ? `${value.toLocaleString()} px` : NONE_DISPLAY
}

// Shared with DateTakenEditor's DateTimePicker (valueFormat) so the edit and
// view modes never drift apart.
export const DATE_TAKEN_FORMAT = 'MMM D, YYYY h:mm A'

type DateTakenStyle = 'full' | 'dateOnly' | 'monthYear'

// dayjs format string per style — 'full' matches DATE_TAKEN_FORMAT above;
// 'dateOnly' drops the time-of-day (used by the newspaper cover's dateline);
// 'monthYear' reads like a real magazine issue date ("MARCH 2026").
const DATE_TAKEN_STYLE_FORMATS: Record<DateTakenStyle, string> = {
  full: DATE_TAKEN_FORMAT,
  dateOnly: 'MMM D, YYYY',
  monthYear: 'MMMM YYYY'
}

export function formatDateTaken(value: string | null, style: DateTakenStyle = 'full'): string {
  if (!value) return NONE_DISPLAY
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATE_TAKEN_STYLE_FORMATS[style]) : NONE_DISPLAY
}

// Per-field label + display formatting, kept here so DetailPanel (and any
// future consumer) never has to compute these at render time.
export function toDisplayMetadata(metadata: PhotoMetadata): DisplayMetadata {
  return {
    dateTaken: field('Date Taken', metadata.dateTaken, formatDateTaken),
    cameraMake: field('Camera Make', metadata.cameraMake, (v) => v ?? NONE_DISPLAY),
    cameraModel: field('Camera Model', metadata.cameraModel, (v) => v ?? NONE_DISPLAY),
    widthPx: field('Width (px)', metadata.widthPx, formatPixels),
    heightPx: field('Height (px)', metadata.heightPx, formatPixels),
    fileSizeBytes: field('File Size', metadata.fileSizeBytes, formatBytes),
    format: field('Format', metadata.format, (v) => v),
    comment: field('Comment', metadata.comment, (v) => v ?? NONE_DISPLAY)
  }
}
