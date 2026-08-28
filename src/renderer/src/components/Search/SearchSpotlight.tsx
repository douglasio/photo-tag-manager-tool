import { memo, type ReactElement, useMemo } from 'react'

import { Badge, Chip, Group, Image, Loader, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import {
  IconFolder,
  IconPhoto,
  IconSearch,
  IconSparkles,
  IconTag,
  IconUser
} from '@tabler/icons-react'

import { usePhotoSearch } from '@renderer/hooks/usePhotoSearch'
import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useSidebarLibrary } from '@renderer/state/PhotoLibrarySidebarContext'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import { predicateKey, serializeSearchQuery, togglePredicate } from '@shared/searchQuery'

const ENTITY_LIMIT = 5
const PHOTO_LIMIT = 7
const THUMB_SIZE = 38

// Chips write predicates into the same parsed query the text box drives, so
// toggling one visibly rewrites the input rather than tracking state beside it.
const FACET_CHIPS = [
  { label: 'Untagged', predicate: { kind: 'flag', field: 'untagged', negated: false } },
  { label: 'Has faces', predicate: { kind: 'flag', field: 'faces', negated: false } },
  { label: 'Has comment', predicate: { kind: 'flag', field: 'comment-present', negated: false } }
] as const

export const SearchSpotlight = memo(function SearchSpotlight(): ReactElement {
  const {
    text,
    setText,
    query,
    result,
    loading,
    semanticResult,
    semanticLoading,
    includeExcluded,
    setIncludeExcluded
  } = usePhotoSearch()
  const { state, allTags } = useSidebarLibrary()
  const {
    selectPhoto,
    openPhotoTab,
    setFolderFilter,
    setFolderTagFilter,
    setPersonFilter,
    setSearchResults
  } = useLibraryActions()

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

  // Opens the photo in its own tab, the same action a gallery double-click
  // takes. Selecting alone only moves the highlight, which is invisible from
  // the Dashboard tab or when the gallery is filtered to another folder.
  const openPhoto = (filePath: string): void => {
    selectPhoto(filePath)
    openPhotoTab(filePath)
    close()
  }

  // Semantic hits already in the exact facet match set are dropped from the
  // Visual matches group — they're not a distinct finding, just a photo that
  // happens to score well both ways.
  const resultPathSet = new Set(result.paths)
  const semanticHits = semanticResult.hits.filter((hit) => !resultPathSet.has(hit.filePath))
  const unindexedCount = semanticResult.totalReadyCount - semanticResult.indexedCount

  const showAllInGallery = (): void => {
    const semanticPaths = semanticHits.map((hit) => hit.filePath)
    setSearchResults({ paths: [...result.paths, ...semanticPaths], label: text.trim() })
    close()
  }

  const photoHits = result.hits.slice(0, PHOTO_LIMIT)
  const hasAnyResult =
    photoHits.length > 0 ||
    semanticHits.length > 0 ||
    // Included so a slow first-use model load doesn't flash "Nothing found"
    // in the gap before the visual matches group has anything to show.
    semanticLoading ||
    entities.tags.length > 0 ||
    entities.people.length > 0 ||
    entities.folders.length > 0

  return (
    <Spotlight.Root
      query={text}
      onQueryChange={setText}
      shortcut="mod + F"
      scrollable
      maxHeight={420}
      // Mantine defaults this overlay to blur: 7 which causes lagginess due to rendering over a long virtualized gallery
      overlayProps={{ blur: 2, backgroundOpacity: 0.5 }}
    >
      <Spotlight.Search
        placeholder="Search photos, tags, people, or contents…"
        leftSection={<IconSearch />}
      />

      <Group gap="xs" px="md" py="xs" wrap="wrap">
        {FACET_CHIPS.map((chip) => {
          const key = predicateKey(chip.predicate)
          const active = query.predicates.some((item) => predicateKey(item) === key)
          return (
            <Chip
              key={chip.label}
              size="xs"
              checked={active}
              onChange={() => setText(serializeSearchQuery(togglePredicate(query, chip.predicate)))}
            >
              {chip.label}
            </Chip>
          )
        })}
        <Chip
          size="xs"
          checked={includeExcluded}
          onChange={() => setIncludeExcluded(!includeExcluded)}
        >
          Include excluded folders
        </Chip>
      </Group>

      <Spotlight.ActionsList>
        {photoHits.length > 0 && (
          <Spotlight.ActionsGroup label={`Photos (${result.total})`}>
            {photoHits.map((hit) => (
              <Spotlight.Action key={hit.filePath} onClick={() => openPhoto(hit.filePath)}>
                <Group wrap="nowrap" w="100%">
                  {hit.thumbnailKey ? (
                    <Image
                      src={toThumbProtocolUrl(hit.thumbnailKey)}
                      w={THUMB_SIZE}
                      h={THUMB_SIZE}
                      radius="sm"
                      fit="cover"
                      alt=""
                    />
                  ) : (
                    <IconPhoto size={THUMB_SIZE} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text truncate>{hit.fileName}</Text>
                    <Text size="xs" opacity={0.6} truncate>
                      {hit.filePath}
                    </Text>
                  </div>
                </Group>
              </Spotlight.Action>
            ))}
            <Spotlight.Action onClick={showAllInGallery}>
              <Group wrap="nowrap">
                <IconPhoto size={20} />
                <Text>
                  {result.total > photoHits.length
                    ? `Show all ${result.total} results in Gallery`
                    : 'Show these results in Gallery'}
                </Text>
              </Group>
            </Spotlight.Action>
          </Spotlight.ActionsGroup>
        )}

        {(semanticHits.length > 0 || semanticLoading) && (
          <Spotlight.ActionsGroup label="Visual matches">
            {semanticHits.map((hit) => (
              <Spotlight.Action key={hit.filePath} onClick={() => openPhoto(hit.filePath)}>
                <Group wrap="nowrap" w="100%">
                  {hit.thumbnailKey ? (
                    <Image
                      src={toThumbProtocolUrl(hit.thumbnailKey)}
                      w={THUMB_SIZE}
                      h={THUMB_SIZE}
                      radius="sm"
                      fit="cover"
                      alt=""
                    />
                  ) : (
                    <IconSparkles size={THUMB_SIZE} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text truncate>{hit.fileName}</Text>
                    <Text size="xs" opacity={0.6} truncate>
                      {hit.filePath}
                    </Text>
                  </div>
                </Group>
              </Spotlight.Action>
            ))}
            {semanticLoading && semanticHits.length === 0 && (
              <Group px="md" py="xs" gap="xs" wrap="nowrap">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  Searching visually…
                </Text>
              </Group>
            )}
            {unindexedCount > 0 && (
              <Group px="md" py="xs" gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {unindexedCount} photo{unindexedCount === 1 ? '' : 's'} not yet indexed for visual
                  search
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
                  ? 'Search by name, tag, comment, or person, or photo contents. Try tag:beach or person:joe before:2020'
                  : 'Nothing found.'}
            </Text>
          </Spotlight.Empty>
        )}
      </Spotlight.ActionsList>

      {result.total > 0 && (
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
