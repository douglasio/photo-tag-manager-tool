import { type ReactElement, useRef } from 'react'

import { Anchor, Box, Breadcrumbs, Divider, SimpleGrid, Stack, Text } from '@mantine/core'

import type { PhotoRecord } from '@shared/types'
import { folderBreadcrumbs } from '@utils'

import type { GalleryThumbnailCellProps } from './GalleryPhotoCell'
import { GalleryThumbnailCell } from './GalleryPhotoCell'

interface GalleryFolderSectionsProps extends Omit<GalleryThumbnailCellProps, 'photo'> {
  rootFolder: string
  sections: string[]
  photosBySection: Map<string, PhotoRecord[]>
  columnCount: number
}

// Non-virtualized alternative to GalleryGrid's react-window <Grid> — used
// when the selected folder has subfolders, splitting the view into one
// breadcrumb-headed section per folder in the subtree (DFS pre-order),
// divided by an <hr>. Not virtualized: fine for the narrower case of a
// folder-scoped view, unlike the flat all-photos grid.
export function GalleryFolderSections({
  rootFolder,
  sections,
  photosBySection,
  columnCount,
  ...thumbnailProps
}: GalleryFolderSectionsProps): ReactElement {
  // Every ancestor crumb points at a section already rendered further up this
  // same scrollable stack, so a click scrolls to it instead of re-selecting
  // the folder (which would swap out the whole section list).
  const sectionRefs = useRef(new Map<string, HTMLDivElement>())

  const scrollToSection = (folder: string): void => {
    sectionRefs.current.get(folder)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Stack gap="lg" p="md">
      {sections.map((folder, index) => {
        const crumbs = folderBreadcrumbs(folder, rootFolder)
        const sectionPhotos = photosBySection.get(folder) ?? []
        return (
          <Box
            key={folder}
            ref={(el) => {
              if (el) sectionRefs.current.set(folder, el)
              else sectionRefs.current.delete(folder)
            }}
          >
            {index > 0 && <Divider mb="lg" />}
            <Breadcrumbs mb="sm" separator="\">
              {crumbs.map((crumb, crumbIndex) =>
                crumbIndex === crumbs.length - 1 ? (
                  <Text key={crumb.path} fw={600}>
                    {crumb.label}
                  </Text>
                ) : (
                  <Anchor key={crumb.path} onClick={() => scrollToSection(crumb.path)}>
                    {crumb.label}
                  </Anchor>
                )
              )}
            </Breadcrumbs>
            {sectionPhotos.length === 0 ? (
              <Text c="dimmed" size="sm">
                No photos in this folder.
              </Text>
            ) : (
              <SimpleGrid cols={columnCount} spacing={0}>
                {sectionPhotos.map((photo) => (
                  <Box key={photo.filePath} p={6}>
                    <GalleryThumbnailCell photo={photo} {...thumbnailProps} />
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}
