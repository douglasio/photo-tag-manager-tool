import { ActionIcon, Group, Slider, Tooltip } from '@mantine/core'
import { IconArrowsMaximize, IconMaximize, IconPhoto } from '@tabler/icons-react'
import type { ReactElement } from 'react'

interface ZoomToolbarProps {
  scale: number
  onScaleChange: (scale: number) => void
  onZoomToFit: () => void
  onZoomToNativeSize: () => void
  onZoomOut: () => void
  onZoomIn: () => void
  min: number
  max: number
}

// Shared zoom control row (fit / native size / out / slider / in) used by
// both PhotoView and the compare view's per-pane image frames.
export function ZoomToolbar({
  scale,
  onScaleChange,
  onZoomToFit,
  onZoomToNativeSize,
  onZoomOut,
  onZoomIn,
  min,
  max
}: ZoomToolbarProps): ReactElement {
  return (
    <Group bg="gray" p="sm" gap="sm" wrap="nowrap">
      {/* Slider stays a plain sibling, not inside ActionIcon.Group — that
          component expects a static label/icon, not a rich control. */}
      <ActionIcon onClick={onZoomToFit} aria-label="Zoom to fit">
        <Tooltip label="Zoom to fit">
          <IconMaximize />
        </Tooltip>
      </ActionIcon>
      <ActionIcon onClick={onZoomToNativeSize} aria-label="Original size">
        <Tooltip label="Original size">
          <IconArrowsMaximize />
        </Tooltip>
      </ActionIcon>
      <ActionIcon onClick={onZoomOut} aria-label="Zoom out">
        <Tooltip label="Zoom out">
          <IconPhoto size={12} />
        </Tooltip>
      </ActionIcon>
      <Slider
        value={scale}
        onChange={onScaleChange}
        min={min}
        max={max}
        step={0.1}
        label={null}
        w={120}
      />
      <ActionIcon onClick={onZoomIn} aria-label="Zoom in">
        <Tooltip label="Zoom in">
          <IconPhoto size={22} />
        </Tooltip>
      </ActionIcon>
    </Group>
  )
}
