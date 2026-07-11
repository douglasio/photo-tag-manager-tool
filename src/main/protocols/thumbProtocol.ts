import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { thumbnailFilePath } from '../services/thumbnailService'

export const THUMB_PROTOCOL = 'photag-thumb'

export function registerThumbProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: THUMB_PROTOCOL, privileges: { secure: true, standard: true, supportFetchAPI: true } }
  ])
}

export function registerThumbProtocolHandler(): void {
  protocol.handle(THUMB_PROTOCOL, async (request) => {
    const thumbnailKey = new URL(request.url).hostname
    const filePath = await thumbnailFilePath(thumbnailKey)
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
