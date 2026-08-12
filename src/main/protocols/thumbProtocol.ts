import { net, protocol } from 'electron'
import { access } from 'fs/promises'
import { pathToFileURL } from 'url'

import { findByThumbnailKey } from '@main/db/photoRepository'
import { generateThumbnail, thumbnailFilePath } from '@main/services/thumbnailService'

const THUMB_PROTOCOL = 'photag-thumb'

export function registerThumbProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: THUMB_PROTOCOL, privileges: { secure: true, standard: true, supportFetchAPI: true } }
  ])
}

// A thumbnail file can go missing without its DB row knowing — most notably
// after "Import Database," which only restores the SQLite file, never the
// thumbnail cache (a different machine, or a cache that's since been
// pruned/cleared here). Rather than serve a permanently broken image,
// regenerate it on the spot from the original photo if that's still
// reachable; if it isn't either, this falls through to the same broken-image
// result a cache miss always produced.
export function registerThumbProtocolHandler(): void {
  protocol.handle(THUMB_PROTOCOL, async (request) => {
    const thumbnailKey = new URL(request.url).hostname
    const filePath = await thumbnailFilePath(thumbnailKey)

    const exists = await access(filePath).then(
      () => true,
      () => false
    )
    if (!exists) {
      const photo = findByThumbnailKey(thumbnailKey)
      if (photo) {
        await generateThumbnail(photo.filePath, thumbnailKey).catch((err: unknown) => {
          console.error(`failed to regenerate missing thumbnail for ${photo.filePath}`, err)
        })
      }
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}
