import { Badge } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

export function FolderBadge({
  isActive,
  children
}: {
  isActive: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Badge
      size="md"
      variant={isActive ? 'filled' : 'light'}
      color={isActive ? undefined : 'gray.8'}
    >
      {children}
    </Badge>
  )
}
