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
      circle
      variant={isActive ? 'filled' : 'transparent'}
      color={isActive ? undefined : 'gray'}
    >
      {children}
    </Badge>
  )
}
