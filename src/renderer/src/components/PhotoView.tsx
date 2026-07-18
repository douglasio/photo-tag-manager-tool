import { ActionIcon, Container, Flex, Group, Image, Slider, Tooltip } from '@mantine/core'
import { IconArrowsMaximize, IconMaximize, IconPhoto } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toFileProtocolUrl } from '../../../shared/protocolUrls'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

const MIN_SCALE = 1
const MAX_SCALE = 5
const SCALE_STEP = 0.25
// A typical wheel "notch" reports a deltaY of roughly 100, matching the
// sensitivity used for the gallery's Ctrl+wheel preview zoom.
const WHEEL_ZOOM_SENSITIVITY = 0.025

interface PhotoViewProps {
  photo: PhotoRecord
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  const { state } = usePhotoLibrary()
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const zoomToFit = (): void => setScale(MIN_SCALE)

  // "Original scale" means true 1:1 pixels — natural image size, not just
  // the current fit-to-container size — so this measures how much the
  // fit="contain" rendering already shrank/grew the image and compensates.
  const zoomToNativeSize = (): void => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return
    const fitScale = Math.min(
      container.clientWidth / img.naturalWidth,
      container.clientHeight / img.naturalHeight
    )
    if (!fitScale) return
    setScale(clampScale(1 / fitScale))
  }

  // Mantine's Tabs keeps every opened photo's panel mounted (not just the
  // active one), so a global keydown listener registered by an inactive tab
  // would otherwise still fire — gate on whether this tab is the one showing.
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = state.activeTab === photo.filePath
  }, [state.activeTab, photo.filePath])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Trackpad pinch gestures are reported by Chromium as wheel events with
    // ctrlKey set to true — there's no separate gesture API in Electron —
    // so this same listener covers both a real pinch and a deliberate
    // Ctrl+scroll. React's synthetic onWheel is passive by default, which
    // silently blocks preventDefault, so this needs a native listener.
    const handleWheel = (event: WheelEvent): void => {
      if (!isActiveRef.current || !event.ctrlKey) return
      event.preventDefault()
      setScale((prev) => clampScale(prev - event.deltaY * WHEEL_ZOOM_SENSITIVITY))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isActiveRef.current || !event.ctrlKey) return
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setScale((prev) => clampScale(prev + SCALE_STEP))
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setScale((prev) => clampScale(prev - SCALE_STEP))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Container
      fluid
      style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, height: '100%' }}
    >
      <Container
        ref={containerRef}
        fluid
        h="100%"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <Image
          ref={imgRef}
          src={toFileProtocolUrl(photo.filePath)}
          alt={photo.fileName}
          fit="contain"
          maw="100%"
          mah="100%"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center'
          }}
        />
      </Container>
      <Flex pos="absolute" bottom={0} left={0} right={0} justify="flex-end" p="md" gap="sm">
        <Group bg="gray" p="sm" gap="sm" wrap="nowrap">
          {/* ActionIcon.Group's seamless merged-pill look depends on every
              sibling sharing one height, and ActionIcon.GroupSection is meant
              for a static label/icon (like Button.GroupSection), not a rich
              control like a Slider — so the Slider stays a plain sibling
              here rather than living inside the group. */}
          <ActionIcon onClick={zoomToFit} aria-label="Zoom to fit">
            <Tooltip label="Zoom to fit">
              <IconMaximize />
            </Tooltip>
          </ActionIcon>
          <ActionIcon onClick={zoomToNativeSize} aria-label="Original size">
            <Tooltip label="Original size">
              <IconArrowsMaximize />
            </Tooltip>
          </ActionIcon>
          <ActionIcon
            onClick={() => setScale((prev) => clampScale(prev - SCALE_STEP))}
            aria-label="Zoom out"
          >
            <Tooltip label="Zoom out">
              <IconPhoto size={12} />
            </Tooltip>
          </ActionIcon>
          <Slider
            value={scale}
            onChange={setScale}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            label={null}
            w={120}
          />
          <ActionIcon
            onClick={() => setScale((prev) => clampScale(prev + SCALE_STEP))}
            aria-label="Zoom in"
          >
            <Tooltip label="Zoom in">
              <IconPhoto size={22} />
            </Tooltip>
          </ActionIcon>
        </Group>
      </Flex>
    </Container>
  )
}
