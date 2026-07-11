import type { ReactElement } from 'react'

interface TagListProps {
  tags: string[]
}

export function TagList({ tags }: TagListProps): ReactElement {
  if (tags.length === 0) {
    return <p className="tag-list__empty">No tags</p>
  }

  return (
    <ul className="tag-list">
      {tags.map((tag) => (
        <li key={tag} className="tag-list__chip">
          {tag}
        </li>
      ))}
    </ul>
  )
}
