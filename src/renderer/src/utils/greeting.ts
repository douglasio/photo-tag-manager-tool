export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening'

// Defaults to the current time — a date param lets callers/tests pin it.
export function getGreeting(date: Date = new Date()): Greeting {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
