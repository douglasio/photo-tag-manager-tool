import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import type { PhotoMetadata } from '@shared/types'

dayjs.extend(relativeTime)

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

// Shared with DateTakenField's DateTimePicker (valueFormat) so the edit and
// view modes never drift apart.
export const DATE_TAKEN_FORMAT = 'MMM D, YYYY h:mm A'

type DateTakenStyle = 'full' | 'dateOnly' | 'monthYear' | 'weekday'

// dayjs format string per style — 'full' matches DATE_TAKEN_FORMAT above;
// 'dateOnly' drops the time-of-day (used by the newspaper cover's dateline);
// 'monthYear' reads like a real magazine issue date ("MARCH 2026");
// 'weekday' is 'dateOnly' plus the day name (used by the gallery list view).
const DATE_TAKEN_STYLE_FORMATS: Record<DateTakenStyle, string> = {
  full: DATE_TAKEN_FORMAT,
  dateOnly: 'MMM D, YYYY',
  monthYear: 'MMMM YYYY',
  weekday: 'dddd, MMM D, YYYY'
}

export function formatDateTaken(value: string | null, style: DateTakenStyle = 'full'): string {
  if (!value) return NONE_DISPLAY
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATE_TAKEN_STYLE_FORMATS[style]) : NONE_DISPLAY
}

// Same format/style set as formatDateTaken, but for a filesystem mtime
// (epoch ms) rather than an EXIF date-taken ISO string — used by the
// Duplicates view's "date modified" column.
export function formatDateModified(
  value: number | null | undefined,
  style: DateTakenStyle = 'full'
): string {
  if (value == null) return NONE_DISPLAY
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATE_TAKEN_STYLE_FORMATS[style]) : NONE_DISPLAY
}

/** "Mar 5, 2020 · 5 years ago" for the detail panel's at-a-glance row.
 * Returns null (rather than NONE_DISPLAY) when there's no parseable date, so
 * the caller omits the row entirely instead of rendering an empty one. */
export function formatDateWithRelative(value: string | null): string | null {
  if (!value) return null
  const parsed = dayjs(value)
  if (!parsed.isValid()) return null
  return `${parsed.format(DATE_TAKEN_STYLE_FORMATS.dateOnly)} · ${parsed.fromNow()}`
}

/** Make + model as one readable camera name, null when neither is known.
 * Model usually already embeds the make ("NIKON D3300"), so the make is only
 * prefixed when it isn't redundant. */
export function formatCamera(make: string | null, model: string | null): string | null {
  const cleanMake = make?.trim() || null
  const cleanModel = model?.trim() || null
  if (!cleanModel) return cleanMake
  if (!cleanMake) return cleanModel
  return cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())
    ? cleanModel
    : `${cleanMake} ${cleanModel}`
}

// Per-field label + display formatting, kept here so DetailPanel (and any
// future consumer) never has to compute these at render time.
export function toDisplayMetadata(metadata: PhotoMetadata): DisplayMetadata {
  return {
    dateTaken: field('Date Taken', metadata.dateTaken, formatDateTaken),
    cameraMake: field('Camera Make', metadata.cameraMake, (v) => v ?? NONE_DISPLAY),
    cameraModel: field('Camera Model', metadata.cameraModel, (v) => v ?? NONE_DISPLAY),
    widthPx: field('Width', metadata.widthPx, formatPixels),
    heightPx: field('Height', metadata.heightPx, formatPixels),
    fileSizeBytes: field('File Size', metadata.fileSizeBytes, formatBytes),
    format: field('Format', metadata.format, (v) => v),
    comment: field('Comment', metadata.comment, (v) => v ?? NONE_DISPLAY)
  }
}
