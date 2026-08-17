import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

// GalleryThumbnailCell pulls in PhotoContextMenu/PhotoThumbnail (dnd-kit,
// usePhotoLibrary, GalleryHoverPreview, …) — irrelevant to what this test
// covers, which is GalleryFolderSections' own section/breadcrumb/divider
// layout, so it's stubbed down to something identifiable per photo.
vi.mock('./GalleryPhotoCell', () => ({
  GalleryThumbnailCell: ({ photo }: { photo: PhotoRecord }) => (
    <div data-testid="thumbnail">{photo.fileName}</div>
  )
}))

import { GalleryFolderSections } from './GalleryFolderSections'

function makePhoto(filePath: string): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

const thumbnailProps = {
  selectedPath: null,
  selectedPaths: new Set<string>(),
  onSelect: vi.fn(),
  renamingPath: null,
  onStartRename: vi.fn(),
  onStopRename: vi.fn(),
  onRename: vi.fn(),
  previewTriggerHeld: false,
  previewScale: 1,
  showFilenames: false,
  showViewCounts: false
}

function renderSections(sections: string[], photosBySection: Map<string, PhotoRecord[]>): void {
  render(
    <MantineProvider>
      <GalleryFolderSections
        rootFolder="/root"
        sections={sections}
        photosBySection={photosBySection}
        columnCount={4}
        cellHeight={200}
        width={800}
        height={2000}
        {...thumbnailProps}
      />
    </MantineProvider>
  )
}

describe('GalleryFolderSections', () => {
  it('renders one thumbnail per photo in a section', () => {
    renderSections(
      ['/root'],
      new Map([['/root', [makePhoto('/root/a.jpg'), makePhoto('/root/b.jpg')]]])
    )

    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
  })

  it('shows an empty-state message for a section with no direct photos', () => {
    renderSections(['/root'], new Map([['/root', []]]))

    expect(screen.getByText('No photos in this folder.')).toBeInTheDocument()
    expect(screen.queryByTestId('thumbnail')).not.toBeInTheDocument()
  })

  it('renders a breadcrumb per section reflecting its depth under rootFolder', () => {
    renderSections(
      ['/root', '/root/child'],
      new Map([
        ['/root', []],
        ['/root/child', [makePhoto('/root/child/a.jpg')]]
      ])
    )

    // "root" appears twice: as its own section's single crumb, and as the
    // first (ancestor) crumb of the "/root/child" section's breadcrumb.
    expect(screen.getAllByText('root')).toHaveLength(2)
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('smooth-scrolls to the target section when an ancestor crumb is clicked', async () => {
    // react-window's List scrolls its own outer scrollable element via
    // scrollTo (jsdom stubs it as a no-op) rather than scrollIntoView.
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo

    const user = userEvent.setup()
    renderSections(
      ['/root', '/root/child'],
      new Map([
        ['/root', []],
        ['/root/child', [makePhoto('/root/child/a.jpg')]]
      ])
    )

    // The ancestor "root" crumb is the Anchor; Mantine's Anchor has no href
    // here, so it doesn't pick up an implicit link role — select via the DOM
    // <a> tag instead.
    const rootCrumb = screen.getAllByText('root').find((el) => el.tagName === 'A')
    await user.click(rootCrumb!)

    // "/root" is the first section, so scrolling to its header row (index 0,
    // align "start") lands at a top offset of 0 regardless of row heights.
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', top: 0 })
  })

  it('separates sections with a divider, but not before the first one', () => {
    renderSections(
      ['/root', '/root/child'],
      new Map([
        ['/root', []],
        ['/root/child', [makePhoto('/root/child/a.jpg')]]
      ])
    )

    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1)
  })

  describe('sticky section header', () => {
    function manyPhotos(prefix: string, count: number): PhotoRecord[] {
      return Array.from({ length: count }, (_, i) => makePhoto(`${prefix}/${i}.jpg`))
    }

    function renderScrollableSections(
      sections: string[],
      photosBySection: Map<string, PhotoRecord[]>
    ): HTMLElement {
      render(
        <MantineProvider>
          <GalleryFolderSections
            rootFolder="/root"
            sections={sections}
            photosBySection={photosBySection}
            columnCount={4}
            cellHeight={200}
            width={800}
            height={400}
            {...thumbnailProps}
          />
        </MantineProvider>
      )
      // react-window's List root is the real, natively-scrolling element —
      // simulating a scroll means setting scrollTop on it directly and
      // firing the event, same as a real scroll would.
      return document.querySelector('[role="list"]') as HTMLElement
    }

    it('does not show a duplicate header while the real one is still at the top', () => {
      renderScrollableSections(
        ['/root/a', '/root/b'],
        new Map([
          ['/root/a', manyPhotos('/root/a', 40)],
          ['/root/b', manyPhotos('/root/b', 40)]
        ])
      )

      expect(screen.getAllByText('a')).toHaveLength(1)
    })

    it('pins the current section breadcrumb to the top once its real header scrolls out of view', () => {
      const scrollContainer = renderScrollableSections(
        ['/root/a', '/root/b'],
        new Map([
          ['/root/a', manyPhotos('/root/a', 40)],
          ['/root/b', manyPhotos('/root/b', 40)]
        ])
      )

      // Far enough that "/root/a"'s real header row (72px tall, at the very
      // top) is outside react-window's overscan window and isn't mounted at
      // all — the only "a" left in the document is the sticky overlay's copy.
      scrollContainer.scrollTop = 900
      fireEvent.scroll(scrollContainer)

      expect(screen.getAllByText('a')).toHaveLength(1)
    })

    it('scrolls to a section when its sticky-header crumb is clicked', async () => {
      const scrollTo = vi.fn()
      Element.prototype.scrollTo = scrollTo
      const user = userEvent.setup()

      const scrollContainer = renderScrollableSections(
        ['/root', '/root/a', '/root/a/b'],
        new Map([
          ['/root', []],
          ['/root/a', manyPhotos('/root/a', 40)],
          ['/root/a/b', manyPhotos('/root/a/b', 4)]
        ])
      )

      // Deep enough into "/root/a"'s photos that both its own real header
      // and "/root"'s are well outside the virtualized render range, so the
      // sticky overlay's "root" ancestor crumb is the only one mounted.
      scrollContainer.scrollTop = 1000
      fireEvent.scroll(scrollContainer)

      const rootCrumb = screen.getAllByText('root').find((el) => el.tagName === 'A')
      await user.click(rootCrumb!)

      expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 0 })
    })
  })

  it('only mounts thumbnails near the viewport, not every photo in the subtree', () => {
    // A single section with far more photos than a small viewport could ever
    // show at once — the whole point of virtualizing this view instead of
    // mounting every PhotoThumbnail (with its own dnd-kit/hover/library-state
    // subscriptions) up front regardless of scroll position.
    const photos = Array.from({ length: 500 }, (_, i) => makePhoto(`/root/${i}.jpg`))
    render(
      <MantineProvider>
        <GalleryFolderSections
          rootFolder="/root"
          sections={['/root']}
          photosBySection={new Map([['/root', photos]])}
          columnCount={4}
          cellHeight={200}
          width={800}
          height={300}
          {...thumbnailProps}
        />
      </MantineProvider>
    )

    const mounted = screen.getAllByTestId('thumbnail').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(photos.length)
  })
})
