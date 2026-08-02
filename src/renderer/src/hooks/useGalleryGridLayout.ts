import { type RefObject, useEffect, useRef, useState } from 'react'

const DEFAULT_CELL_WIDTH = 168
// The filename label below each thumbnail takes roughly this much extra
// vertical space regardless of thumbnail size, so cell height tracks width
// with a constant offset rather than a fixed aspect ratio.
const CELL_LABEL_HEIGHT = 28
const MIN_CELL_WIDTH = 100
// Stays under thumbnailService's THUMBNAIL_LONG_EDGE (640px) so the largest
// setting still displays a natively-generated thumbnail rather than upscaling it.
const MAX_CELL_WIDTH = 600
// react-window's Grid renders its own vertical scrollbar inside the width we
// give it, so column math needs to leave room for it — otherwise the last
// column overflows the scrollbar's width and the grid gains an unwanted
// horizontal scrollbar.
const SCROLLBAR_RESERVE_PX = 16
// The gallery stays mounted (just hidden) while a photo tab is active —
// Mantine's Tabs keeps inactive panels around via React's Activity API —
// so returning to it re-expands the AppShell Navbar/Aside via their own CSS
// transition while this grid is already visible. Without debouncing, the
// ResizeObserver below would fire on every frame of that transition,
// reflowing thumbnails into new column counts live. A debounce (rather than
// a fixed delay guessed to match the transition's duration) waits for
// resize events to actually stop before committing a size, so it self-
// corrects regardless of how long any given transition takes.
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
  // True from the moment a resize starts until it settles — the grid still
  // renders at its old (stale) column count/size while this is true, so the
  // caller can hide it instead of showing that live reflow, then fade it
  // back in once this flips false and the grid has already caught up.
  isSettling: boolean
}

// Owns GalleryGrid's container measurement (debounced against AppShell
// transitions) and thumbnail-size state (persisted, with the +/- buttons and
// slider both landing exactly on SIZE_MARK_VALUES).
export function useGalleryGridLayout({
  photoCount,
  showFilenames
}: UseGalleryGridLayoutOptions): UseGalleryGridLayoutResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH)
  // Starts true so the not-yet-measured default size above never flashes on
  // mount either — both cases resolve the same way, via the first settle.
  const [isSettling, setIsSettling] = useState(true)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setIsSettling(true)
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        setSize({ width, height })
        setIsSettling(false)
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

  // Pick the column count closest to the target cell width, then stretch each
  // column to exactly fill the available width — avoids a leftover sliver of
  // empty space on the right that a plain floor-division would leave behind.
  const availableWidth = Math.max(size.width - SCROLLBAR_RESERVE_PX, 0)
  const columnCount = Math.max(1, Math.round(availableWidth / cellWidth))
  const actualCellWidth = availableWidth > 0 ? availableWidth / columnCount : cellWidth
  const cellHeight = actualCellWidth + (showFilenames ? CELL_LABEL_HEIGHT : 0)
  const rowCount = Math.ceil(photoCount / columnCount)

  // The +/- buttons jump between the slider's own SIZE_MARK_VALUES rather
  // than stepping by a fixed pixel amount, so they always land exactly on a
  // mark instead of somewhere between two of them.
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
    stepToMark,
    isSettling
  }
}
