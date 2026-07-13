export function isNullOrEmpty(value: unknown): boolean {
  return value == null || String(value).trim() === ''
}
