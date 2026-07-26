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
      opacity={isDragging ? 0.5 : undefined}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined
      }}
      {...tabProps}
      {...attributes}
      {...listeners}
    />
  )
}
