import { AppLayout, StartupLoadingScreen } from '@components'

import { PhotoLibraryProvider } from './state/PhotoLibraryContext'
import { useGalleryLibrary } from './state/PhotoLibraryGalleryContext'

// Kept separate from AppLayout so its hooks (keyboard shortcuts, drag sensors) are never
// conditionally skipped when initialLoadComplete flips.
export function AppGate(): React.JSX.Element {
  const { state } = useGalleryLibrary()
  return state.initialLoadComplete ? <AppLayout /> : <StartupLoadingScreen />
}

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <AppGate />
    </PhotoLibraryProvider>
  )
}

export default App
