// Simple case-insensitive substring match against the full path — no glob
// syntax, so a pattern like ".picasaoriginals" excludes any file or folder
// whose path contains it, regardless of where in the tree it appears.
export function matchesExcludePattern(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const lowerPath = path.toLowerCase()
  return patterns.some(
    (pattern) => pattern.trim() !== '' && lowerPath.includes(pattern.toLowerCase())
  )
}
