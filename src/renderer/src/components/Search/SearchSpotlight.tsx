import { memo, type ReactElement, useMemo, useState } from 'react'

import { Badge, Chip, Group, Image, Text, Transition } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import {
  IconArrowLeft,
  IconChevronRight,
  IconFolder,
  IconPhoto,
  IconSearch,
  IconSparkles,
  IconTag,
  IconUser
} from '@tabler/icons-react'

import { usePhotoSearch } from '@renderer/hooks/usePhotoSearch'
import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useScanProgress } from '@renderer/state/PhotoLibraryScanProgressContext'
import { useSidebarLibrary } from '@renderer/state/PhotoLibrarySidebarContext'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import { predicateKey, serializeSearchQuery, togglePredicate } from '@shared/searchQuery'
import type { SearchHit } from '@shared/types'

const ENTITY_LIMIT = 5
const PHOTO_ROW_LIMIT = 7
const ROW_THUMB_SIZE = 64
const GRID_THUMB_SIZE = 64
const SLIDE_DURATION = 200

// Chips write predicates into the same parsed query the text box drives, so
// toggling one visibly rewrites the input rather than tracking state beside it.
const FACET_CHIPS = [
  { label: 'untagged', predicate: { kind: 'flag', field: 'untagged', negated: false } },
  { label: 'has faces', predicate: { kind: 'flag', field: 'faces', negated: false } }
  // { label: 'has comment', predicate: { kind: 'flag', field: 'comment-present', negated: false } }
] as const

// Thumbnail-only tile shared by the compact row and the expanded grid — photo
// results deliberately carry no filename/path text, so the image (or its
// fallback icon) is the entire visible content and the accessible name.
function ResultThumb({
  hit,
  size,
  Fallback
}: {
  hit: SearchHit
  size: number
  Fallback: typeof IconPhoto
}): ReactElement {
  return hit.thumbnailKey ? (
    <Image
      src={toThumbProtocolUrl(hit.thumbnailKey)}
      w={size}
      h={size}
      radius="sm"
      fit="cover"
      alt={hit.fileName}
    />
  ) : (
    <Fallback size={size} />
  )
}

export const SearchSpotlight = memo(function SearchSpotlight(): ReactElement {
  const {
    text,
    setText,
    query,
    result,
    loading,
    semanticResult,
    semanticLoading,
    modelDownloadProgress,
    includeExcluded,
    setIncludeExcluded
  } = usePhotoSearch()
  const { state, allTags } = useSidebarLibrary()
  const { embeddingIndexProgress } = useScanProgress()
  const {
    selectPhoto,
    openPhotoTab,
    setFolderFilter,
    setFolderTagFilter,
    setPersonFilter,
    setSearchResults
  } = useLibraryActions()

  const [includeVisualMatches, setIncludeVisualMatches] = useState(true)

  const [expanded, setExpanded] = useState(false)
  const [prevText, setPrevText] = useState(text)
  if (text !== prevText) {
    setPrevText(text)
    setExpanded(false)
  }

  // Tags, people, and folders are small in-memory sets, so they're matched
  // here rather than over IPC — only the photo corpus needs the main process.
  const needle = text.trim().toLocaleLowerCase()
  const entities = useMemo(() => {
    if (needle.length === 0) return { tags: [], people: [], folders: [] }
    const match = (value: string): boolean => value.toLocaleLowerCase().includes(needle)
    return {
      tags: allTags.filter(match).slice(0, ENTITY_LIMIT),
      people: state.people
        .filter((person) => person.name !== null && match(person.name))
        .slice(0, ENTITY_LIMIT),
      // allFolderPaths, not state.folders — the latter is only the watched
      // roots, so subfolders (where people actually navigate) would be missing.
      folders: [...state.allFolderPaths].filter(match).sort().slice(0, ENTITY_LIMIT)
    }
  }, [needle, allTags, state.people, state.allFolderPaths])

  const close = (): void => spotlight.close()
  const back = (): void => setExpanded(false)

  // Opens the photo in its own tab, the same action a gallery double-click
  // takes. Selecting alone only moves the highlight, which is invisible from
  // the Dashboard tab or when the gallery is filtered to another folder.
  const openPhoto = (filePath: string): void => {
    selectPhoto(filePath)
    openPhotoTab(filePath)
    close()
  }

  // Semantic hits already in the exact facet match set are dropped — a photo
  // already found by the exact scan isn't a distinct visual finding.
  const resultPathSet = new Set(result.paths)
  const semanticHits = semanticResult.hits.filter((hit) => !resultPathSet.has(hit.filePath))
  const unindexedCount = semanticResult.totalReadyCount - semanticResult.indexedCount

  const mergedHits = includeVisualMatches ? [...result.hits, ...semanticHits] : result.hits
  const mergedPaths = includeVisualMatches
    ? [...result.paths, ...semanticHits.map((hit) => hit.filePath)]
    : result.paths
  const mergedTotal = includeVisualMatches ? result.total + semanticHits.length : result.total

  const showPhotosInGallery = (): void => {
    setSearchResults({ paths: mergedPaths, label: text.trim() })
    close()
  }

  const photoRow = mergedHits.slice(0, PHOTO_ROW_LIMIT)
  const hasAnyResult =
    mergedHits.length > 0 ||
    // Included so a slow first-use model load doesn't flash "Nothing found"
    // in the gap before visual matches have anything to add.
    (includeVisualMatches && semanticLoading) ||
    entities.tags.length > 0 ||
    entities.people.length > 0 ||
    entities.folders.length > 0

  const backAction = (
    <Spotlight.Action onClick={back} closeSpotlightOnTrigger={false}>
      <Group gap="xs" wrap="nowrap">
        <IconArrowLeft size={16} />
        <Text size="sm">Back</Text>
      </Group>
    </Spotlight.Action>
  )

  return (
    <Spotlight.Root
      query={text}
      onQueryChange={setText}
      shortcut="mod + F"
      scrollable
      maxHeight={420}
      // Mantine defaults this overlay to blur: 7 which causes lagginess due to rendering over a long virtualized gallery
      overlayProps={{ blur: 2, backgroundOpacity: 0.5 }}
      onSpotlightClose={back}
    >
      <Spotlight.Search
        placeholder="Search photos, tags, people, or contents…"
        leftSection={<IconSearch />}
      />

      {!expanded && (
        <Group gap="xs" px="md" py="xs" pt={0} mt={0} wrap="wrap">
          <Chip
            size="xs"
            checked={includeVisualMatches}
            icon={<IconSparkles size={12} />}
            onChange={() => setIncludeVisualMatches(!includeVisualMatches)}
          >
            visual matches
          </Chip>
          <Chip
            size="xs"
            checked={includeExcluded}
            onChange={() => setIncludeExcluded(!includeExcluded)}
          >
            excluded folders
          </Chip>
          {FACET_CHIPS.map((chip) => {
            const key = predicateKey(chip.predicate)
            const active = query.predicates.some((item) => predicateKey(item) === key)
            return (
              <Chip
                key={chip.label}
                size="xs"
                checked={active}
                onChange={() =>
                  setText(serializeSearchQuery(togglePredicate(query, chip.predicate)))
                }
              >
                {chip.label}
              </Chip>
            )
          })}
        </Group>
      )}

      <Spotlight.ActionsList>
        {/* The expanded list slides in from the right ("forward"); the
            compact row below slides in from the left ("back") — both
            directions use Mantine's stock slide presets, no custom transition. */}
        <Transition mounted={expanded} transition="slide-left" duration={SLIDE_DURATION}>
          {(styles) => (
            <Spotlight.ActionsGroup label={`Photos (${mergedTotal})`} style={styles}>
              {backAction}
              <Group gap="xs" px="md" py="xs" wrap="wrap">
                {mergedHits.map((hit) => (
                  <Spotlight.Action
                    key={hit.filePath}
                    aria-label={hit.fileName}
                    onClick={() => openPhoto(hit.filePath)}
                    style={{ width: GRID_THUMB_SIZE + 8, flex: '0 0 auto', padding: 4 }}
                  >
                    <ResultThumb hit={hit} size={GRID_THUMB_SIZE} Fallback={IconPhoto} />
                  </Spotlight.Action>
                ))}
              </Group>
              <Spotlight.Action onClick={showPhotosInGallery}>
                <Group wrap="nowrap" gap="xs">
                  <IconPhoto size={20} />
                  <Text>
                    Show <strong>{mergedHits.length}</strong> results in gallery
                  </Text>
                </Group>
              </Spotlight.Action>
            </Spotlight.ActionsGroup>
          )}
        </Transition>

        <Transition mounted={!expanded} transition="slide-right" duration={SLIDE_DURATION}>
          {(styles) => (
            <div style={styles}>
              {(photoRow.length > 0 || (includeVisualMatches && semanticLoading)) && (
                <Spotlight.ActionsGroup label={`Photos (${mergedTotal})`}>
                  <Group gap="xs" px="md" py="xs" wrap="nowrap">
                    {photoRow.map((hit) => (
                      <Spotlight.Action
                        key={hit.filePath}
                        aria-label={hit.fileName}
                        onClick={() => openPhoto(hit.filePath)}
                        style={{ width: ROW_THUMB_SIZE + 8, flex: '0 0 auto', padding: 4 }}
                      >
                        <ResultThumb hit={hit} size={ROW_THUMB_SIZE} Fallback={IconPhoto} />
                      </Spotlight.Action>
                    ))}
                  </Group>
                  {mergedHits.length > PHOTO_ROW_LIMIT ? (
                    <Spotlight.Action
                      onClick={() => setExpanded(true)}
                      closeSpotlightOnTrigger={false}
                    >
                      <Group wrap="nowrap" justify="space-between" w="100%">
                        <Text size="sm">
                          View all <strong>{mergedTotal}</strong>
                        </Text>
                        <IconChevronRight size={16} />
                      </Group>
                    </Spotlight.Action>
                  ) : (
                    photoRow.length > 0 && (
                      <Spotlight.Action onClick={showPhotosInGallery}>
                        <Group wrap="nowrap">
                          <IconPhoto size={20} />
                          <Text>Show these results in Gallery</Text>
                        </Group>
                      </Spotlight.Action>
                    )
                  )}
                  {includeVisualMatches &&
                    (modelDownloadProgress !== null ||
                      embeddingIndexProgress ||
                      unindexedCount > 0) && (
                      <Group px="md" py="xs" gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed">
                          {modelDownloadProgress !== null
                            ? `Downloading visual search model… ${modelDownloadProgress}%`
                            : embeddingIndexProgress
                              ? `Indexing for visual search… ${embeddingIndexProgress.done} of ${embeddingIndexProgress.total}`
                              : `${unindexedCount} photo${unindexedCount === 1 ? '' : 's'} not yet indexed for visual search`}
                        </Text>
                      </Group>
                    )}
                </Spotlight.ActionsGroup>
              )}

              {entities.tags.length > 0 && (
                <Spotlight.ActionsGroup label="Tags">
                  {entities.tags.map((tag) => (
                    <Spotlight.Action
                      key={tag}
                      label={tag}
                      leftSection={<IconTag size={20} />}
                      onClick={() => {
                        setFolderTagFilter(tag)
                        close()
                      }}
                    />
                  ))}
                </Spotlight.ActionsGroup>
              )}

              {entities.people.length > 0 && (
                <Spotlight.ActionsGroup label="People">
                  {entities.people.map((person) => (
                    <Spotlight.Action
                      key={person.id}
                      label={person.name ?? 'Unnamed person'}
                      leftSection={<IconUser size={20} />}
                      rightSection={<Badge variant="default">{person.faceCount}</Badge>}
                      onClick={() => {
                        setPersonFilter(person.id)
                        close()
                      }}
                    />
                  ))}
                </Spotlight.ActionsGroup>
              )}

              {entities.folders.length > 0 && (
                <Spotlight.ActionsGroup label="Folders">
                  {entities.folders.map((folder) => (
                    <Spotlight.Action
                      key={folder}
                      label={folder}
                      leftSection={<IconFolder size={20} />}
                      onClick={() => {
                        setFolderFilter(folder)
                        close()
                      }}
                    />
                  ))}
                </Spotlight.ActionsGroup>
              )}

              {!hasAnyResult && (
                <Spotlight.Empty>
                  <Text c="dimmed" size="sm">
                    {loading
                      ? 'Searching…'
                      : needle.length === 0
                        ? 'Try tag:beach or person:joe before:2020'
                        : 'Nothing found.'}
                  </Text>
                </Spotlight.Empty>
              )}
            </div>
          )}
        </Transition>
      </Spotlight.ActionsList>

      {!expanded && result.total > 0 && (
        <Group px="md" py="xs" gap="xs">
          <IconPhoto size={14} opacity={0.5} />
          <Text size="xs" opacity={0.6}>
            Enter opens the highlighted result · {result.total} photo
            {result.total === 1 ? '' : 's'} matched
          </Text>
        </Group>
      )}
    </Spotlight.Root>
  )
})
