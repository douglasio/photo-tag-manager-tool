import { type RefObject, useEffect, useRef, useState } from 'react'

const DEFAULT_CELL_WIDTH = 168
// Extra vertical space the filename/view-count row + its padding need,
// added to cell height. Too small and the card overlaps the row below it.
const CELL_LABEL_HEIGHT = 38
const MIN_CELL_WIDTH = 100
// Stays under thumbnailService's THUMBNAIL_LONG_EDGE (640px) to avoid upscaling.
const MAX_CELL_WIDTH = 600
// react-window's own scrollbar eats into the width we give it; without this
// the last column overflows and the grid gains a horizontal scrollbar too.
const SCROLLBAR_RESERVE_PX = 16
// Debounces the ResizeObserver below so the AppShell's panel-collapse CSS
// transition doesn't reflow thumbnails into new column counts every frame.
const RESIZE_SETTLE_MS = 100

function clampCellWidth(value: number): number {
  return Math.min(MAX_CELL_WIDTH, Math.max(MIN_CELL_WIDTH, value))
}

// Evenly spaced tick marks spanning the slider's actual min/max range, so
// they land at real, reachable cell-width values rather than arbitrary points.
const SIZE_MARK_COUNT = 5
const SIZE_MARK_VALUES = Array.from(
  { length: SIZE_MARK_COUNT },
  (_, index) => MIN_CELL_WIDTH + ((MAX_CELL_WIDTH - MIN_CELL_WIDTH) * index) / (SIZE_MARK_COUNT - 1)
)
const SIZE_MARKS = SIZE_MARK_VALUES.map((value) => ({ value }))

interface UseGalleryGridLayoutOptions {
  photoCount: number
  showFilenames: boolean
  // Shares the filename's label row rather than adding its own, so the
  // height budget below only needs reserving once either is on.
  showViewCounts: boolean
}

interface UseGalleryGridLayoutResult {
  containerRef: RefObject<HTMLDivElement | null>
  size: { width: number; height: number }
  cellWidth: number
  minCellWidth: number
  maxCellWidth: number
  sizeMarks: { value: number }[]
  columnCount: number
  actualCellWidth: number
  cellHeight: number
  rowCount: number
  setCellWidth: (width: number) => void
  setCellWidthPersisted: (width: number) => void
  stepToMark: (delta: number) => void
}

// Owns GalleryGrid's container measurement and persisted thumbnail-size state.
export function useGalleryGridLayout({
  photoCount,
  showFilenames,
  showViewCounts
}: UseGalleryGridLayoutOptions): UseGalleryGridLayoutResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        setSize({ width, height })
      }, RESIZE_SETTLE_MS)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [])

  useEffect(() => {
    window.api.getGalleryCellWidth().then((width) => {
      if (width !== null) setCellWidth(clampCellWidth(width))
    })
  }, [])

  const setCellWidthPersisted = (width: number): void => {
    const clamped = clampCellWidth(width)
    setCellWidth(clamped)
    void window.api.setGalleryCellWidth(clamped)
  }

  // Nearest column count to the target width, stretched to fill exactly —
  // avoids a leftover sliver of empty space on the right.
  const availableWidth = Math.max(size.width - SCROLLBAR_RESERVE_PX, 0)
  const columnCount = Math.max(1, Math.round(availableWidth / cellWidth))
  const actualCellWidth = availableWidth > 0 ? availableWidth / columnCount : cellWidth
  const cellHeight = actualCellWidth + (showFilenames || showViewCounts ? CELL_LABEL_HEIGHT : 0)
  const rowCount = Math.ceil(photoCount / columnCount)

  // Jumps between SIZE_MARK_VALUES rather than a fixed pixel step, so the
  // +/- buttons always land exactly on a mark.
  const stepToMark = (delta: number): void => {
    const closestIndex = SIZE_MARK_VALUES.reduce(
      (closest, value, index) =>
        Math.abs(value - cellWidth) < Math.abs(SIZE_MARK_VALUES[closest] - cellWidth)
          ? index
          : closest,
      0
    )
    const nextIndex = Math.min(SIZE_MARK_VALUES.length - 1, Math.max(0, closestIndex + delta))
    setCellWidthPersisted(SIZE_MARK_VALUES[nextIndex])
  }

  return {
    containerRef,
    size,
    cellWidth,
    minCellWidth: MIN_CELL_WIDTH,
    maxCellWidth: MAX_CELL_WIDTH,
    sizeMarks: SIZE_MARKS,
    columnCount,
    actualCellWidth,
    cellHeight,
    rowCount,
    setCellWidth,
    setCellWidthPersisted,
    stepToMark
  }
}
