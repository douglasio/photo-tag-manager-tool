import { ActionIcon, Box, Group } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconPencil } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface InlineEditFieldProps {
  editing: boolean
  onStartEdit: () => void
  children: ReactNode
  // 'start' (default) shrink-wraps the content when not editing, so the
  // pencil icon hugs left-aligned text (FileNameEditor, TagNameEditor).
  // 'center' keeps the content full-width at all times, so centered text
  // (e.g. gallery captions) actually centers instead of collapsing to its
  // own content width.
  contentAlign?: 'start' | 'center'
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
  children,
  contentAlign = 'start'
}: InlineEditFieldProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  // In 'center' mode the pencil overlays on top instead of sitting in the
  // flex flow — otherwise, even at opacity 0, it still occupies width on one
  // side only, which both throws off centering and (since it disappears
  // entirely while editing) shifts the text's available width — and so its
  // position — the moment edit mode toggles.
  if (contentAlign === 'center') {
    return (
      <Box ref={ref} pos="relative">
        <Box
          onDoubleClick={() => {
            if (!editing) onStartEdit()
          }}
          style={{ width: '100%', minWidth: 0 }}
        >
          {children}
        </Box>
        {!editing && (
          <ActionIcon
            style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              transform: 'translateY(-50%)',
              opacity: hovered ? 0.7 : 0
            }}
            onClick={onStartEdit}
          >
            <IconPencil />
          </ActionIcon>
        )}
      </Box>
    )
  }

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
          style={{
            opacity: hovered ? 0.7 : 0
          }}
          onClick={onStartEdit}
        >
          <IconPencil />
        </ActionIcon>
      )}
    </Group>
  )
}
