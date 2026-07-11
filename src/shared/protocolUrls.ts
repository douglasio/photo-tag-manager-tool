export function toThumbProtocolUrl(thumbnailKey: string): string {
  return `photag-thumb://${thumbnailKey}`
}

export function toFileProtocolUrl(filePath: string): string {
  return `photag-file://local/${encodeURIComponent(filePath)}`
}
