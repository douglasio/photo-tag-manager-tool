import { Chip } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconX } from '@tabler/icons-react'
import type { ReactElement } from 'react'

interface DetailPanelTagChipProps {
  tag: string
  // Parent already computes this for the Chip.Group's value — passed in
  // separately since the hover-to-remove swap needs it too.
  checked: boolean
}

// Shared by DetailPanelQuickTag and DetailPanelMultiSelect — hovering a
// checked chip swaps its checkmark for a red X, signaling that clicking
// again removes the tag rather than just deselecting it.
export function DetailPanelTagChip({ tag, checked }: DetailPanelTagChipProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()
  const showRemove = checked && hovered

  return (
    <Chip
      value={tag}
      // Redundant with Chip.Group's own context-derived checked state (both
      // read the same data), but keeps this correct standalone too.
      checked={checked}
      rootRef={ref}
      color={showRemove ? 'red' : undefined}
      icon={showRemove ? <IconX size={12} /> : undefined}
    >
      {tag}
    </Chip>
  )
}
