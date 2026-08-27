import { Badge, Group, Skeleton, Stack } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconSparkles } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactElement } from 'react'

import type { TagSuggestion } from '@shared/types'

import { SectionTitle } from './SectionTitle'
import { TagHoverCard } from './TagHoverCard'

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
  const motionEnabled = !useReducedMotion()

  if (!loading && suggestions.length === 0) return null

  return (
    <Stack gap="md" mt="xs">
      <SectionTitle icon={IconSparkles}>Suggested</SectionTitle>
      {loading ? (
        <Group gap="xs">
          <Skeleton height={22} width={70} radius="xl" />
          <Skeleton height={22} width={90} radius="xl" />
          <Skeleton height={22} width={60} radius="xl" />
        </Group>
      ) : (
        <Group gap="xs">
          <AnimatePresence>
            {suggestions.map((suggestion) => (
              <motion.div
                key={suggestion.tag}
                layout={motionEnabled}
                exit={motionEnabled ? { scale: 2, opacity: 0, filter: 'blur(5px)' } : undefined}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <TagHoverCard tag={suggestion.tag}>
                  <Badge
                    component="button"
                    variant="gradient"
                    size="lg"
                    tt="none"
                    style={{
                      cursor: 'pointer'
                    }}
                    onClick={() => onAccept(suggestion.tag)}
                  >
                    + {suggestion.tag}
                  </Badge>
                </TagHoverCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </Group>
      )}
    </Stack>
  )
}
