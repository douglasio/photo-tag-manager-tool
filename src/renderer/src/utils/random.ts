// Fisher-Yates shuffle — returns a new array in random order, leaving the
// input untouched.
export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Picks one random element from a non-empty array.
export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}
