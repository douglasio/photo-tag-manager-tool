import { Tabs, type TabsTabProps } from '@mantine/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactElement } from 'react'

interface SortableTabProps extends TabsTabProps {
  id: string
}

/** A Tabs.Tab that can be drag-reordered within its enclosing SortableContext. */
export function SortableTab({ id, style, ...tabProps }: SortableTabProps): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  return (
    <Tabs.Tab
      ref={setNodeRef}
      style={{
        ...style,
        // CSS.Transform (unlike Translate) includes a scaleX/scaleY the
        // sorting strategy computes to preview swapping into a
        // differently-sized slot — since tabs vary in width by filename
        // length, that scale visibly stretched/squished the dragged tab.
        // Translate-only drops that component and just repositions it.
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        zIndex: isDragging ? 1 : undefined
      }}
      {...tabProps}
      {...attributes}
      {...listeners}
    />
  )
}
