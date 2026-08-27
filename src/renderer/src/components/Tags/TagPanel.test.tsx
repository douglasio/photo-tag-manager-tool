import { DndContext } from '@dnd-kit/core'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const mockDeleteTag = vi.fn().mockResolvedValue(undefined)

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  useSidebarLibrary: () => ({
    allTags: ['vacation'],
    tagCounts: new Map([['vacation', 2]]),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map(),
    state: {
      selectedTag: null,
      tagDescriptions: new Map(),
      tagGroups: [],
      tagGroupAssignments: new Map(),
      tagsPanelGridView: false
    }
  }),
  useLibraryActions: () => ({
    setTagFilter: vi.fn(),
    renameTag: vi.fn(),
    deleteTag: mockDeleteTag
  }),
  useActiveDragKind: () => null
}))

import { TagPanel } from './TagPanel'

// Regression test for a real bug: TagListItem used to wrap its Button in a
// <Tooltip> that was ALSO the direct child of TagContextMenu's
// Menu.ContextMenu. Mantine's Tooltip only forwards a fixed prop whitelist
// (onClick, onMouseEnter, ...) onto a wrapped child — onContextMenu isn't in
// it — so right-clicking never reached the button and no menu opened. Fixed
// by giving Tooltip a `target` ref instead of wrapping.
describe('TagPanel context menu', () => {
  it('opens the Rename menu item on right-click', async () => {
    render(
      <MantineProvider>
        <DndContext onDragEnd={() => {}}>
          <TagPanel />
        </DndContext>
      </MantineProvider>
    )

    fireEvent.contextMenu(screen.getByText('vacation'))

    expect(await screen.findByText('Rename')).toBeInTheDocument()
  })

  it('deletes the tag via the same confirmation dialog used elsewhere, after confirming', async () => {
    const user = userEvent.setup()
    render(
      <MantineProvider>
        <DndContext onDragEnd={() => {}}>
          <TagPanel />
        </DndContext>
      </MantineProvider>
    )

    fireEvent.contextMenu(screen.getByText('vacation'))
    await user.click(await screen.findByText('Delete'))

    expect(mockDeleteTag).not.toHaveBeenCalled()
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('Delete tag')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(mockDeleteTag).toHaveBeenCalledExactlyOnceWith('vacation')
  })
})
