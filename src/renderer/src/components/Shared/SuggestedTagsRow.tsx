import { Badge, Group, Loader, Stack, Text } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import type { TagSuggestion } from '@shared/types'

interface SuggestedTagsRowProps {
  suggestions: TagSuggestion[]
  loading: boolean
  onAccept: (tag: string) => void
}

// AI-suggested tags for the current photo, as clickable gradient badges —
// shared by DetailPanelQuickTag and the QuickTag dashboard widget. Renders
// nothing once there's neither a pending fetch nor anything to show.
export function SuggestedTagsRow({
  suggestions,
  loading,
  onAccept
}: SuggestedTagsRowProps): ReactElement | null {
  if (!loading && suggestions.length === 0) return null

  return (
    <Stack gap={4}>
      <Group gap={4}>
        <IconSparkles size={14} />
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          Suggested
        </Text>
      </Group>
      {loading ? (
        <Loader size="xs" />
      ) : (
        <Group gap="xs">
          {suggestions.map((suggestion) => (
            <Badge
              key={suggestion.tag}
              component="button"
              variant="gradient"
              style={{ cursor: 'pointer' }}
              onClick={() => onAccept(suggestion.tag)}
            >
              + {suggestion.tag}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  )
}
