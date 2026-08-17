import { type ReactElement, useCallback, useMemo, useState } from 'react'

import { Anchor, Box, Breadcrumbs, Divider, SimpleGrid, Text } from '@mantine/core'
import { List, type RowComponentProps, useListRef } from 'react-window'

import type { PhotoRecord } from '@shared/types'
import { folderBreadcrumbs } from '@utils'

import type { GalleryThumbnailCellProps } from './GalleryPhotoCell'
import { GalleryThumbnailCell } from './GalleryPhotoCell'

// Tall enough for a breadcrumb line plus its divider/margins — the row is
// clipped (not measured) if a very deep folder path would wrap past this.
const HEADER_ROW_HEIGHT = 72
const EMPTY_ROW_HEIGHT = 40
const CELL_PADDING = 6

type SectionRow =
  | { kind: 'header'; folder: string; isFirst: boolean }
  | { kind: 'empty'; folder: string }
  | { kind: 'photos'; photos: PhotoRecord[] }

function getRowHeight(row: SectionRow, cellHeight: number): number {
  if (row.kind === 'header') return HEADER_ROW_HEIGHT
  if (row.kind === 'empty') return EMPTY_ROW_HEIGHT
  return cellHeight
}

interface FolderBreadcrumbHeaderProps {
  folder: string
  rootFolder: string
  onCrumbClick: (folder: string) => void
}

// Shared by the in-flow header row and the sticky overlay below, so both
// stay visually identical.
function FolderBreadcrumbHeader({
  folder,
  rootFolder,
  onCrumbClick
}: FolderBreadcrumbHeaderProps): ReactElement {
  const crumbs = folderBreadcrumbs(folder, rootFolder)
  return (
    <Breadcrumbs mb="sm" separator="\">
      {crumbs.map((crumb, crumbIndex) =>
        crumbIndex === crumbs.length - 1 ? (
          <Text key={crumb.path} fw={600} textWrap="nowrap">
            {crumb.label}
          </Text>
        ) : (
          <Anchor key={crumb.path} onClick={() => onCrumbClick(crumb.path)} textWrap="nowrap">
            {crumb.label}
          </Anchor>
        )
      )}
    </Breadcrumbs>
  )
}

interface FolderSectionRowProps extends Omit<GalleryThumbnailCellProps, 'photo'> {
  rows: SectionRow[]
  rootFolder: string
  columnCount: number
  cellHeight: number
  onCrumbClick: (folder: string) => void
}

// One virtualized row: a section's breadcrumb header, its "no photos" empty
// state, or one row of up to columnCount photos — react-window recycles this
// across all three kinds based on what `rows[index]` is.
function GalleryFolderSectionRow({
  index,
  style,
  rows,
  rootFolder,
  columnCount,
  onCrumbClick,
  ...thumbnailProps
}: RowComponentProps<FolderSectionRowProps>): ReactElement {
  const row = rows[index]

  if (row.kind === 'header') {
    return (
      <Box style={{ ...style, overflow: 'hidden' }} px="md" pt="md">
        {!row.isFirst && <Divider mb="lg" />}
        <FolderBreadcrumbHeader
          folder={row.folder}
          rootFolder={rootFolder}
          onCrumbClick={onCrumbClick}
        />
      </Box>
    )
  }

  if (row.kind === 'empty') {
    return (
      <Box style={style} px="md">
        <Text c="dimmed" size="sm">
          No photos in this folder.
        </Text>
      </Box>
    )
  }

  return (
    <Box style={style}>
      <SimpleGrid cols={columnCount} spacing={0}>
        {row.photos.map((photo) => (
          <Box key={photo.filePath} p={CELL_PADDING}>
            <GalleryThumbnailCell photo={photo} {...thumbnailProps} />
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  )
}

interface StickySectionHeaderProps {
  folder: string
  rootFolder: string
  width: number
  onCrumbClick: (folder: string) => void
  // How far up (px) the incoming section's real header has pushed this
  // overlay, once it's scrolled within HEADER_ROW_HEIGHT of the top — makes
  // the sticky header feel handed off rather than abruptly swapped.
  pushOffset: number
}

// Painted after (and therefore on top of) the List below it in DOM order —
// both are position:auto-z-index elements in the same stacking context, so
// no explicit z-index is needed to keep this above the scrolling rows.
function StickySectionHeader({
  folder,
  rootFolder,
  width,
  onCrumbClick,
  pushOffset
}: StickySectionHeaderProps): ReactElement {
  return (
    <Box
      pos="absolute"
      top={-pushOffset}
      left={0}
      w={width}
      bg="var(--mantine-color-body)"
      px="md"
      pt="md"
    >
      <FolderBreadcrumbHeader folder={folder} rootFolder={rootFolder} onCrumbClick={onCrumbClick} />
      <Divider />
    </Box>
  )
}

interface GalleryFolderSectionsProps extends Omit<GalleryThumbnailCellProps, 'photo'> {
  rootFolder: string
  sections: string[]
  photosBySection: Map<string, PhotoRecord[]>
  columnCount: number
  cellHeight: number
  width: number
  height: number
}

// Virtualized (react-window List) alternative to GalleryGrid's own <Grid> —
// used when the selected folder has subfolders, splitting the view into one
// breadcrumb-headed section per folder in the subtree (DFS pre-order). Every
// section/photo row is flattened into a single row list so only rows near
// the viewport ever mount — a subfolder subtree with thousands of photos
// used to mount every one of them at once.
export function GalleryFolderSections({
  rootFolder,
  sections,
  photosBySection,
  columnCount,
  cellHeight,
  width,
  height,
  ...thumbnailProps
}: GalleryFolderSectionsProps): ReactElement {
  const listRef = useListRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const { rows, headerRowIndex } = useMemo(() => {
    const rows: SectionRow[] = []
    const headerRowIndex = new Map<string, number>()
    sections.forEach((folder, sectionIndex) => {
      headerRowIndex.set(folder, rows.length)
      rows.push({ kind: 'header', folder, isFirst: sectionIndex === 0 })
      const sectionPhotos = photosBySection.get(folder) ?? []
      if (sectionPhotos.length === 0) {
        rows.push({ kind: 'empty', folder })
        return
      }
      for (let i = 0; i < sectionPhotos.length; i += columnCount) {
        rows.push({ kind: 'photos', photos: sectionPhotos.slice(i, i + columnCount) })
      }
    })
    return { rows, headerRowIndex }
  }, [sections, photosBySection, columnCount])

  const headerOffsets = useMemo(() => {
    const entries: { folder: string; offset: number }[] = []
    let offset = 0
    for (const row of rows) {
      if (row.kind === 'header') entries.push({ folder: row.folder, offset })
      offset += getRowHeight(row, cellHeight)
    }
    return entries
  }, [rows, cellHeight])

  // Track the List's real scroll position so the sticky header can follow it
  const handleRowsRendered = useCallback((): void => {
    setScrollTop(listRef.current?.element?.scrollTop ?? 0)
  }, [listRef])

  const stickyHeader = useMemo(() => {
    if (headerOffsets.length === 0) return null
    let activeIndex = 0
    for (let i = 0; i < headerOffsets.length; i++) {
      if (headerOffsets[i].offset <= scrollTop) activeIndex = i
      else break
    }
    const active = headerOffsets[activeIndex]
    if (scrollTop <= active.offset) return null
    const next = headerOffsets[activeIndex + 1]
    const pushOffset = next ? Math.max(0, HEADER_ROW_HEIGHT - (next.offset - scrollTop)) : 0
    return { folder: active.folder, pushOffset }
  }, [headerOffsets, scrollTop])

  // Every ancestor crumb points at a section already flattened into this same
  // row list — scrolls the virtualized list to it (rather than re-selecting
  // the folder, which would swap out the whole section list). Stabilized for
  // the same reason as handleRowsRendered above — it's part of rowProps.
  const scrollToSection = useCallback(
    (folder: string): void => {
      const index = headerRowIndex.get(folder)
      if (index === undefined) return
      listRef.current?.scrollToRow({ index, align: 'start', behavior: 'smooth' })
    },
    [headerRowIndex, listRef]
  )

  const rowProps: FolderSectionRowProps = {
    rows,
    rootFolder,
    columnCount,
    cellHeight,
    onCrumbClick: scrollToSection,
    ...thumbnailProps
  }

  return (
    <Box pos="relative" w={width} h={height}>
      <List
        listRef={listRef}
        rowComponent={GalleryFolderSectionRow}
        rowCount={rows.length}
        rowHeight={(index, props) => getRowHeight(props.rows[index], props.cellHeight)}
        rowProps={rowProps}
        onRowsRendered={handleRowsRendered}
        defaultHeight={height}
        style={{ width, height }}
      />
      {stickyHeader && (
        <StickySectionHeader
          folder={stickyHeader.folder}
          rootFolder={rootFolder}
          width={width}
          onCrumbClick={scrollToSection}
          pushOffset={stickyHeader.pushOffset}
        />
      )}
    </Box>
  )
}
