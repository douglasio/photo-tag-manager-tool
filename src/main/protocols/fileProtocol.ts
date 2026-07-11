import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'

export const FILE_PROTOCOL = 'photag-file'

export function registerFileProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: FILE_PROTOCOL, privileges: { secure: true, standard: true, supportFetchAPI: true } }
  ])
}

export function registerFileProtocolHandler(): void {
  protocol.handle(FILE_PROTOCOL, async (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.slice(1))
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
