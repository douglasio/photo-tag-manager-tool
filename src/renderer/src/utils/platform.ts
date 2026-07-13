export const isMac = window.electron.process.platform === 'darwin'

export const ctrlKeyLabel = isMac ? 'Ctrl (⌃)' : 'Ctrl'
