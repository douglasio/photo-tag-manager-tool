import { type ComboboxData, type ComboboxRenderPillInput, Pill, TagsInput } from '@mantine/core'
import type { ReactElement } from 'react'

import { TagHoverCard } from '@components'

interface TagListProps {
  tags: string[]
  allTags: string[]
  recentTags: string[]
  onChange: (tags: string[]) => void
}

// Wraps TagsInput's default pill so it gets the same hover-popover
// (name + description) as every other tag chip in the app.
function renderPill({ option, onRemove, disabled }: ComboboxRenderPillInput): ReactElement {
  // option.value is typed as Primitive (tags are always strings in practice,
  // this data set is built entirely from tag strings).
  const tag = String(option.value)
  return (
    <TagHoverCard tag={tag}>
      <Pill
        withRemoveButton={!disabled}
        onRemove={onRemove}
        disabled={disabled}
        bg="var(--mantine-primary-color-light)"
      >
        {tag}
      </Pill>
    </TagHoverCard>
  )
}

export function TagList({ tags, allTags, recentTags, onChange }: TagListProps): ReactElement {
  // Only excludes tags that no longer exist at all (deleted)
  const availableRecent = recentTags.filter((tag) => allTags.includes(tag))
  // shows already-applied tags as disabled in the "Recent" group, so users can see them but not re-add them
  const recentItems = availableRecent.map((tag) => {
    const alreadyApplied = tags.includes(tag)
    return {
      value: tag,
      label: alreadyApplied ? `${tag} (added)` : tag,
      disabled: alreadyApplied
    }
  })
  // Every value in a Combobox's data must be unique
  const rest = allTags.filter((tag) => !availableRecent.includes(tag))
  const data: ComboboxData =
    availableRecent.length > 0
      ? [
          { group: 'Recent', items: recentItems },
          { group: 'Other Tags', items: rest }
        ]
      : allTags

  return (
    <TagsInput
      value={tags}
      onChange={onChange}
      data={data}
      placeholder="Add a tag…"
      size="md"
      renderPill={renderPill}
    />
  )
}
