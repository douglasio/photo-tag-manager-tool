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
 * hover (click to edit). `align="flex-start"` pins the icon to the top of
 * the content — not vertically centered — so it lands in the same place
 * relative to the first line of text whether that text is a single short
 * line or wraps across several, which is what made it look inconsistently
 * placed from field to field before. Callers own the editing/draft state
 * and pass their EditableText (or equivalent) as children.
 */
export function InlineEditField({
  editing,
  onStartEdit,
  children
}: InlineEditFieldProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Group ref={ref} gap={4} wrap="nowrap" align="flex-start">
      <Box
        onDoubleClick={() => {
          if (!editing) onStartEdit()
        }}
        flex={1}
        miw={0}
      >
        {children}
      </Box>
      {!editing && (
        <ActionIcon opacity={hovered ? 0.7 : 0} onClick={onStartEdit} style={{ flexShrink: 0 }}>
          <IconPencil />
        </ActionIcon>
      )}
    </Group>
  )
}
