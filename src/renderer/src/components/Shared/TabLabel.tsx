import { Fragment, type ReactElement } from 'react'

import { Group, Text, Tooltip } from '@mantine/core'

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
  fileNames: string[]
}

/**
 * Compare-tab label (2-4 photos) — each filename truncates independently
 * within a shared width budget, so every ↔ stays visible instead of one long
 * name swallowing the rest.
 */
export function CompareTabLabel({ fileNames }: CompareTabLabelProps): ReactElement {
  return (
    <Tooltip label={fileNames.join(' ↔ ')} openDelay={TOOLTIP_OPEN_DELAY}>
      <Group gap={4} wrap="nowrap" maw={MAX_LABEL_WIDTH}>
        {fileNames.map((fileName, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <Text size="sm" style={{ flexShrink: 0 }}>
                ↔
              </Text>
            )}
            <Text size="sm" truncate="end" style={{ minWidth: 0, flex: 1 }}>
              {fileName}
            </Text>
          </Fragment>
        ))}
      </Group>
    </Tooltip>
  )
}
