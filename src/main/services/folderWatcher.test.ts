// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockWatch, fakeWatcher, mockClose } = vi.hoisted(() => {
  const handlers: Record<string, (arg: string) => void> = {}
  const mockClose = vi.fn().mockResolvedValue(undefined)
  const fakeWatcher = {
    handlers,
    on: vi.fn(function (
      this: typeof fakeWatcher,
      event: string,
      cb: (arg: string) => void
    ): typeof fakeWatcher {
      handlers[event] = cb
      return this
    }),
    close: mockClose
  }
  const mockWatch = vi.fn().mockReturnValue(fakeWatcher)
  return { mockWatch, fakeWatcher, mockClose }
})

vi.mock('chokidar', () => ({ watch: mockWatch }))

import { startWatching, stopAllWatchers, stopWatching } from './folderWatcher'

describe('folderWatcher', () => {
  beforeEach(() => {
    mockWatch.mockClear()
    mockClose.mockClear()
  })

  it('starts a chokidar watcher and registers all handlers', () => {
    const onFileEvent = vi.fn()
    const onDirEvent = vi.fn()
    startWatching('/root-a', { onFileEvent, onDirEvent })

    expect(mockWatch).toHaveBeenCalledWith(
      '/root-a',
      expect.objectContaining({ ignoreInitial: true })
    )
    expect(fakeWatcher.handlers.add).toBeInstanceOf(Function)
    expect(fakeWatcher.handlers.change).toBeInstanceOf(Function)
    expect(fakeWatcher.handlers.unlink).toBeInstanceOf(Function)
    expect(fakeWatcher.handlers.addDir).toBeInstanceOf(Function)
    expect(fakeWatcher.handlers.unlinkDir).toBeInstanceOf(Function)
    expect(fakeWatcher.handlers.error).toBeInstanceOf(Function)
  })

  it('only forwards supported file extensions', () => {
    const onFileEvent = vi.fn()
    startWatching('/root-b', { onFileEvent, onDirEvent: vi.fn() })

    fakeWatcher.handlers.add('/root-b/photo.jpg')
    fakeWatcher.handlers.add('/root-b/notes.txt')
    fakeWatcher.handlers.change('/root-b/photo.PNG')
    fakeWatcher.handlers.unlink('/root-b/photo.jpg')

    expect(onFileEvent).toHaveBeenCalledWith('add', '/root-b/photo.jpg')
    expect(onFileEvent).toHaveBeenCalledWith('change', '/root-b/photo.PNG')
    expect(onFileEvent).toHaveBeenCalledWith('unlink', '/root-b/photo.jpg')
    expect(onFileEvent).not.toHaveBeenCalledWith('add', '/root-b/notes.txt')
    expect(onFileEvent).toHaveBeenCalledTimes(3)
  })

  it('reports directory events except for the root path itself', () => {
    const onDirEvent = vi.fn()
    startWatching('/root-c', { onFileEvent: vi.fn(), onDirEvent })

    fakeWatcher.handlers.addDir('/root-c')
    fakeWatcher.handlers.addDir('/root-c/sub')
    fakeWatcher.handlers.unlinkDir('/root-c/sub')

    expect(onDirEvent).toHaveBeenCalledWith('addDir', '/root-c/sub')
    expect(onDirEvent).toHaveBeenCalledWith('unlinkDir', '/root-c/sub')
    expect(onDirEvent).toHaveBeenCalledTimes(2)
  })

  it('logs watcher errors without throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    startWatching('/root-d', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })
    fakeWatcher.handlers.error(new Error('boom') as never)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('does not start a second watcher for an already-watched root', () => {
    startWatching('/root-e', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })
    startWatching('/root-e', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })
    expect(mockWatch).toHaveBeenCalledTimes(1)
  })

  it('stopWatching closes and forgets the watcher, and is a no-op for an unwatched root', async () => {
    startWatching('/root-f', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })
    await stopWatching('/root-f')
    expect(mockClose).toHaveBeenCalledTimes(1)

    await stopWatching('/never-watched')
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('stopAllWatchers closes every currently-watched root, including ones from earlier tests', async () => {
    startWatching('/root-g', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })
    startWatching('/root-h', { onFileEvent: vi.fn(), onDirEvent: vi.fn() })

    await stopAllWatchers()
    // watchers is shared module state, so this also closes every root left
    // over (i.e. not already stopped) from earlier tests in this file — the
    // meaningful assertion is just that g/h (started in this test) are gone.
    expect(mockClose).toHaveBeenCalled()

    mockClose.mockClear()
    await stopWatching('/root-g')
    await stopWatching('/root-h')
    expect(mockClose).not.toHaveBeenCalled()
  })
})
