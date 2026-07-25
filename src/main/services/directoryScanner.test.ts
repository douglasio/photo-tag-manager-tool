// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanAllFolders, scanDirectory } from './directoryScanner'

describe('directoryScanner', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'photag-scan-test-'))
    writeFileSync(join(root, 'a.jpg'), '')
    writeFileSync(join(root, 'notes.txt'), '')
    mkdirSync(join(root, 'sub'))
    writeFileSync(join(root, 'sub', 'b.PNG'), '')
    mkdirSync(join(root, 'excluded'))
    writeFileSync(join(root, 'excluded', 'c.jpg'), '')
    mkdirSync(join(root, 'empty'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('scanDirectory', () => {
    it('finds only supported image files, case-insensitively', async () => {
      const found = await scanDirectory(root)
      const relative = found.map((p) => p.slice(root.length + 1)).sort()
      expect(relative).toEqual(['a.jpg', 'excluded/c.jpg', join('sub', 'b.PNG')].sort())
    })

    it('excludes files/folders matching an exclude pattern', async () => {
      const found = await scanDirectory(root, ['excluded'])
      const relative = found.map((p) => p.slice(root.length + 1)).sort()
      expect(relative).toEqual(['a.jpg', join('sub', 'b.PNG')].sort())
    })
  })

  describe('scanAllFolders', () => {
    it('lists every folder under root, including empty ones, without trailing separators', async () => {
      const folders = await scanAllFolders(root)
      const relative = folders.map((f) => (f === root ? '.' : f.slice(root.length + 1))).sort()
      expect(relative).toEqual(['.', 'empty', 'excluded', 'sub'].sort())
      expect(folders.every((f) => !/[/\\]$/.test(f))).toBe(true)
    })

    it('excludes matching folders from the listing', async () => {
      const folders = await scanAllFolders(root, ['excluded'])
      const relative = folders.map((f) => (f === root ? '.' : f.slice(root.length + 1))).sort()
      expect(relative).toEqual(['.', 'empty', 'sub'].sort())
    })
  })
})
