export function toThumbProtocolUrl(thumbnailKey: string): string {
  return `photag-thumb://${thumbnailKey}`
}

// cacheBust: pass something that changes whenever the file's bytes do (e.g.
// thumbnailKey, which is itself derived from mtime/size) — otherwise the
// <img>'s src stays byte-identical across a rewrite (tag/date/comment/
// rotate edits all rewrite the file in place at the same path), so neither
// React nor the browser ever re-fetches, and edits that change what the
// image actually looks like (like a rotate) silently don't appear.
export function toFileProtocolUrl(filePath: string, cacheBust?: string | null): string {
  const url = `photag-file://local/${encodeURIComponent(filePath)}`
  return cacheBust ? `${url}?v=${encodeURIComponent(cacheBust)}` : url
}
