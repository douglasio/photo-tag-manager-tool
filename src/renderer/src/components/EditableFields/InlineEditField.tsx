import { ActionIcon, Box, Group, Tooltip } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconPencil } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface InlineEditFieldProps {
  editing: boolean
  onStartEdit: () => void
  children: ReactNode
  // True for fields that need to occupy the full row width
  fill?: boolean
}

// Shared hover/toggle chrome for an inline-editable field
export function InlineEditField({
  editing,
  onStartEdit,
  children,
  fill = false
}: InlineEditFieldProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Group ref={ref} gap={4} wrap="nowrap" align="flex-start">
      <Box
        onDoubleClick={() => {
          if (!editing) onStartEdit()
        }}
        flex={fill ? 1 : '0 1 auto'}
        miw={0}
        maw="100%"
        style={{ cursor: editing ? undefined : 'pointer' }}
      >
        {children}
      </Box>
      {!editing && (
        <Tooltip label="Edit">
          <ActionIcon opacity={hovered ? 0.7 : 0} onClick={onStartEdit} style={{ flexShrink: 0 }}>
            <IconPencil />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  )
}
