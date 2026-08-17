// Simple case-insensitive substring match against the full path
export function matchesExcludePattern(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const lowerPath = path.toLowerCase()
  return patterns.some(
    (pattern) => pattern.trim() !== '' && lowerPath.includes(pattern.toLowerCase())
  )
}
