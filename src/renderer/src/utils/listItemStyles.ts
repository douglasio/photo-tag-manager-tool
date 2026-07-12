export function activeHoverBackground(isActive: boolean, hovered: boolean): string | undefined {
  if (isActive) {
    return hovered
      ? 'var(--mantine-primary-color-light-hover)'
      : 'var(--mantine-primary-color-light)'
  }
  return hovered ? 'var(--mantine-color-default-hover)' : undefined
}
