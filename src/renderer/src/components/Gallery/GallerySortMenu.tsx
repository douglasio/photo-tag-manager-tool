import { ActionIcon, Group, Tooltip } from '@mantine/core'
import type { GallerySortBy, GallerySortOrder } from '@state'
import {
  IconArrowsShuffle,
  IconCalendarDown,
  IconCalendarUp,
  IconSortAscendingNumbers,
  IconSortAZ,
  IconSortDescendingNumbers,
  IconSortZA
} from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'
import { ACTION_ICONS } from '@utils'

export function GallerySortMenu(): ReactElement {
  const { state, setSort } = usePhotoLibrary()

  const { ICON_SIZE } = ACTION_ICONS

  // Clicking the already-active sort's icon flips its direction; clicking a
  // different sort's icon switches to it at its default direction (matching
  // what used to be the first-listed option for each: Name A-Z, Date
  // taken newest-first, view count most-first).
  const toggle = (sortBy: GallerySortBy, defaultOrder: GallerySortOrder): void => {
    if (state.sortBy === sortBy) {
      setSort(sortBy, state.sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(sortBy, defaultOrder)
    }
  }

  const nameDesc = state.sortBy === 'name' && state.sortOrder === 'desc'
  const dateAsc = state.sortBy === 'dateTaken' && state.sortOrder === 'asc'
  const viewAsc = state.sortBy === 'viewCount' && state.sortOrder === 'asc'
  const NameIcon = nameDesc ? IconSortZA : IconSortAZ
  const DateIcon = dateAsc ? IconCalendarUp : IconCalendarDown
  const ViewIcon = viewAsc ? IconSortAscendingNumbers : IconSortDescendingNumbers

  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={`Name (${nameDesc ? 'Z–A' : 'A–Z'})`}>
        <ActionIcon
          variant={state.sortBy === 'name' ? 'filled' : 'default'}
          aria-label="Sort by name"
          onClick={() => toggle('name', 'asc')}
        >
          <NameIcon size={ICON_SIZE} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={`Date taken (${dateAsc ? 'Oldest' : 'Newest'})`}>
        <ActionIcon
          variant={state.sortBy === 'dateTaken' ? 'filled' : 'default'}
          aria-label="Sort by date taken"
          onClick={() => toggle('dateTaken', 'desc')}
        >
          <DateIcon size={ICON_SIZE} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={`View count (${viewAsc ? 'Least' : 'Most'})`}>
        <ActionIcon
          variant={state.sortBy === 'viewCount' ? 'filled' : 'default'}
          aria-label="Sort by view count"
          onClick={() => toggle('viewCount', 'desc')}
        >
          <ViewIcon size={ICON_SIZE} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Random">
        <ActionIcon
          variant={state.sortBy === 'random' ? 'filled' : 'default'}
          aria-label="Random order"
          onClick={() => setSort('random', 'asc')}
        >
          <IconArrowsShuffle size={ICON_SIZE} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}
