import { type ReactElement, type RefObject, useEffect, useState } from 'react'

import { Tooltip } from '@mantine/core'

export const DELEGATED_TOOLTIP_ATTR = 'data-delegated-tooltip'

interface DelegatedTooltipProps {
  containerRef: RefObject<HTMLElement | null>
}

export function DelegatedTooltip({ containerRef }: DelegatedTooltipProps): ReactElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseOver = (event: MouseEvent): void => {
      const item =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(`[${DELEGATED_TOOLTIP_ATTR}]`)
          : null
      if (!item) {
        setTarget(null)
        return
      }
      setTarget(item)
      setLabel(item.getAttribute(DELEGATED_TOOLTIP_ATTR) ?? '')
    }
    const handleMouseLeave = (): void => setTarget(null)

    container.addEventListener('mouseover', handleMouseOver)
    container.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      container.removeEventListener('mouseover', handleMouseOver)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [containerRef])

  if (!target) return null

  return <Tooltip target={target} label={label} opened />
}
