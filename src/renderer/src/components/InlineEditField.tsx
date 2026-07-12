import { ActionIcon, Box, Group } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconPencil } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface InlineEditFieldProps {
  editing: boolean
  onStartEdit: () => void
  children: ReactNode
}

/**
 * Shared hover/toggle chrome for an inline-editable field: content on the
 * left (double-click to edit), a pencil icon beside it that only appears on
 * hover (single click to edit). Callers own the editing/draft state and swap
 * `children` between their view and edit content.
 */
export function InlineEditField({
  editing,
  onStartEdit,
  children
}: InlineEditFieldProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Group ref={ref} gap={4} wrap="nowrap" align="center">
      <Box
        onDoubleClick={() => {
          if (!editing) onStartEdit()
        }}
        style={{ flex: editing ? 1 : 'initial', minWidth: 0 }}
      >
        {children}
      </Box>
      {!editing && (
        <ActionIcon
          variant="subtle"
          size="sm"
          style={{
            flexShrink: 0,
            opacity: hovered ? 0.7 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 120ms ease'
          }}
          onClick={onStartEdit}
        >
          <IconPencil />
        </ActionIcon>
      )}
    </Group>
  )
}
