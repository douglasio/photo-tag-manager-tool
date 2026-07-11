import { PhotoLibraryProvider } from './state/PhotoLibraryContext'
import { FolderPicker } from './components/FolderPicker'
import { ScanProgressBar } from './components/ScanProgressBar'
import { GalleryGrid } from './components/GalleryGrid'
import { DetailPanel } from './components/DetailPanel'

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Tag Me</h1>
          <FolderPicker />
          <ScanProgressBar />
        </header>
        <div className="app__body">
          <GalleryGrid />
          <DetailPanel />
        </div>
      </div>
    </PhotoLibraryProvider>
  )
}

export default App
