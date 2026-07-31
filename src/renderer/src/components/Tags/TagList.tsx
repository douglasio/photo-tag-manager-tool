import { type ComboboxData, TagsInput } from '@mantine/core'
import type { ReactElement } from 'react'

interface TagListProps {
  tags: string[]
  allTags: string[]
  recentTags: string[]
  onChange: (tags: string[]) => void
}

export function TagList({ tags, allTags, recentTags, onChange }: TagListProps): ReactElement {
  // Only excludes tags that no longer exist at all (deleted) — deliberately
  // NOT filtered against this photo's own tags, so the "Recent" section is
  // identical no matter which photo is selected.
  const availableRecent = recentTags.filter((tag) => allTags.includes(tag))
  // TagsInput unconditionally strips any tag already in `value` out of its
  // dropdown data (filterPickedTags), matched by label text — with no prop
  // to opt out. Rather than let an already-applied recent tag silently
  // vanish (confusing — "where did it go?"), give it a label that doesn't
  // match the plain tag text so it survives that filter, and mark it
  // disabled so it still reads as "already added" instead of selectable.
  const recentItems = availableRecent.map((tag) => {
    const alreadyApplied = tags.includes(tag)
    return {
      value: tag,
      label: alreadyApplied ? `${tag} (added)` : tag,
      disabled: alreadyApplied
    }
  })
  // Every value in a Combobox's data must be unique — Mantine looks options
  // up by value in a flat map keyed off it (getOptionsLockup), so a tag
  // appearing in both "Recent" and the full list overwrites its own lockup
  // entry and produces inconsistent/broken selection behavior.
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
      styles={{
        pill: {
          backgroundColor: 'var(--mantine-primary-color-light)'
        }
      }}
    />
  )
}
