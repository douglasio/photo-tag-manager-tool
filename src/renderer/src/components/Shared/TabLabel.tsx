import { Group, Text, Tooltip } from '@mantine/core'
import type { ReactElement } from 'react'

const MAX_LABEL_WIDTH = 160
const TOOLTIP_OPEN_DELAY = 400

interface TabLabelProps {
  fileName: string
}

/** Single-photo tab label — truncated with an ellipsis, full name on hover. */
export function TabLabel({ fileName }: TabLabelProps): ReactElement {
  return (
    <Tooltip label={fileName} openDelay={TOOLTIP_OPEN_DELAY}>
      <Text size="sm" truncate="end" maw={MAX_LABEL_WIDTH}>
        {fileName}
      </Text>
    </Tooltip>
  )
}

interface CompareTabLabelProps {
  fileNameA: string
  fileNameB: string
}

/**
 * Compare-tab label — each filename truncates independently within a shared
 * width budget, so ↔ stays visible instead of one long name swallowing it.
 */
export function CompareTabLabel({ fileNameA, fileNameB }: CompareTabLabelProps): ReactElement {
  return (
    <Tooltip label={`${fileNameA} ↔ ${fileNameB}`} openDelay={TOOLTIP_OPEN_DELAY}>
      <Group gap={4} wrap="nowrap" maw={MAX_LABEL_WIDTH}>
        <Text size="sm" truncate="end" style={{ minWidth: 0, flex: 1 }}>
          {fileNameA}
        </Text>
        <Text size="sm" style={{ flexShrink: 0 }}>
          ↔
        </Text>
        <Text size="sm" truncate="end" style={{ minWidth: 0, flex: 1 }}>
          {fileNameB}
        </Text>
      </Group>
    </Tooltip>
  )
}
