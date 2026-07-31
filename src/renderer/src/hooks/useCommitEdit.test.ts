import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useCommitEdit } from './useCommitEdit'

describe('useCommitEdit', () => {
  it('exits edit mode after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const setEditing = vi.fn()
    const { result } = renderHook(() => useCommitEdit(onSave, setEditing))

    await result.current('new value')

    expect(onSave).toHaveBeenCalledWith('new value')
    expect(setEditing).toHaveBeenCalledWith(false)
  })

  it('stays in edit mode when the save rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    const setEditing = vi.fn()
    const { result } = renderHook(() => useCommitEdit(onSave, setEditing))

    await result.current('new value')

    expect(setEditing).not.toHaveBeenCalled()
  })

  it('ignores a re-entrant commit while the first save is still in flight', async () => {
    let resolveFirst!: () => void
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(undefined)
    const setEditing = vi.fn()
    const { result } = renderHook(() => useCommitEdit(onSave, setEditing))

    const firstCall = result.current('first')
    const secondCall = result.current('second')

    expect(onSave).toHaveBeenCalledTimes(1)
    resolveFirst()
    await Promise.all([firstCall, secondCall])
    expect(setEditing).toHaveBeenCalledTimes(1)
  })
})
