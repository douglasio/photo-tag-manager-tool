import type { FaceBox, FaceRecord, PersonRecord } from '@shared/types'

import { getDb } from './database'

interface FaceRow {
  id: string
  photo_path: string
  box_x: number
  box_y: number
  box_w: number
  box_h: number
  person_id: string | null
  person_id_pinned: number
}

function toFaceRecord(row: FaceRow): FaceRecord {
  return {
    id: row.id,
    photoPath: row.photo_path,
    box: { x: row.box_x, y: row.box_y, w: row.box_w, h: row.box_h },
    personId: row.person_id,
    personIdPinned: row.person_id_pinned === 1
  }
}

const FACE_ROW_COLUMNS = 'id, photo_path, box_x, box_y, box_w, box_h, person_id, person_id_pinned'

export function getFacesForPhoto(photoPath: string): FaceRecord[] {
  const rows = getDb()
    .prepare(`SELECT ${FACE_ROW_COLUMNS} FROM photo_faces WHERE photo_path = ?`)
    .all(photoPath) as FaceRow[]
  return rows.map(toFaceRecord)
}

/** Every (photo, person) pairing — a photo can carry more than one row if it
 * has faces belonging to different people. Used to build the gallery's
 * filter-by-person lookup client-side, the same way tag filtering already
 * reads directly off each photo's own tags. */
export function getPersonPhotoAssignments(): { photoPath: string; personId: string }[] {
  const rows = getDb()
    .prepare('SELECT DISTINCT photo_path, person_id FROM photo_faces WHERE person_id IS NOT NULL')
    .all() as { photo_path: string; person_id: string }[]
  return rows.map((row) => ({ photoPath: row.photo_path, personId: row.person_id }))
}

// A photo with zero detected faces looks identical to a never-scanned one
// (no rows either way) — this simplification means a face-less photo gets
// re-run on every scan rather than skipped, unlike thumbnailStatus's
// explicit 'ready'/'pending' tracking. Acceptable for v1: re-detecting a
// face-less photo is cheap relative to a full scan.
export function hasFacesForPhoto(photoPath: string): boolean {
  return (
    getDb().prepare('SELECT 1 FROM photo_faces WHERE photo_path = ? LIMIT 1').get(photoPath) !==
    undefined
  )
}

export function insertFace(face: {
  photoPath: string
  box: FaceBox
  embedding: Float32Array
}): FaceRecord {
  const id = crypto.randomUUID()
  const buffer = Buffer.from(
    face.embedding.buffer,
    face.embedding.byteOffset,
    face.embedding.byteLength
  )
  getDb()
    .prepare(
      `INSERT INTO photo_faces (id, photo_path, box_x, box_y, box_w, box_h, embedding, detected_at)
       VALUES (@id, @photoPath, @boxX, @boxY, @boxW, @boxH, @embedding, @detectedAt)`
    )
    .run({
      id,
      photoPath: face.photoPath,
      boxX: face.box.x,
      boxY: face.box.y,
      boxW: face.box.w,
      boxH: face.box.h,
      embedding: buffer,
      detectedAt: Date.now()
    })
  return { id, photoPath: face.photoPath, box: face.box, personId: null, personIdPinned: false }
}

/** Faces DBSCAN should consider on the next clustering pass — pinned faces
 * (manually assigned/split/unassigned) are excluded entirely, the same way
 * reconcileTagGroups skips a pinned tag. */
export function getUnpinnedFaces(): { id: string; embedding: Float32Array }[] {
  const rows = getDb()
    .prepare('SELECT id, embedding FROM photo_faces WHERE person_id_pinned = 0')
    .all() as { id: string; embedding: Buffer }[]
  return rows.map((row) => ({
    id: row.id,
    embedding: new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
    )
  }))
}

/** Pinned, person-assigned faces — used as reference centroids so a new
 * DBSCAN cluster can be matched back to an existing person instead of always
 * creating a new one. */
export function getPinnedAssignedFaces(): {
  id: string
  personId: string
  embedding: Float32Array
}[] {
  const rows = getDb()
    .prepare(
      'SELECT id, person_id, embedding FROM photo_faces WHERE person_id_pinned = 1 AND person_id IS NOT NULL'
    )
    .all() as { id: string; person_id: string; embedding: Buffer }[]
  return rows.map((row) => ({
    id: row.id,
    personId: row.person_id,
    embedding: new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
    )
  }))
}

/** Automatic cluster assignment — does not pin, so a later manual override
 * (or a future re-cluster) can still move this face. */
export function applyAutoClusterAssignment(faceId: string, personId: string | null): void {
  getDb().prepare('UPDATE photo_faces SET person_id = ? WHERE id = ?').run(personId, faceId)
}

/** Self-healing cover face: falls back to the person's earliest-detected
 * face if cover_face_id is unset or no longer belongs to this person,
 * rather than requiring every mutation to keep it perfectly in sync. */
function getPeopleWhere(hidden: 0 | 1): PersonRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.name, p.description,
         COALESCE(
           (SELECT id FROM photo_faces WHERE id = p.cover_face_id AND person_id = p.id),
           (SELECT id FROM photo_faces WHERE person_id = p.id ORDER BY detected_at LIMIT 1)
         ) AS coverFaceId,
         (SELECT COUNT(*) FROM photo_faces WHERE person_id = p.id) AS faceCount
       FROM people p
       WHERE p.hidden = ?
       ORDER BY p.created_at`
    )
    .all(hidden) as Omit<PersonRecord, 'coverPhotoPath'>[]

  return rows.map((row) => {
    const coverPhotoPath = row.coverFaceId
      ? ((
          getDb()
            .prepare('SELECT photo_path FROM photo_faces WHERE id = ?')
            .get(row.coverFaceId) as { photo_path: string } | undefined
        )?.photo_path ?? null)
      : null
    return { ...row, coverPhotoPath }
  })
}

export function getPeople(): PersonRecord[] {
  return getPeopleWhere(0)
}

/** People hidden via hidePerson() — surfaced only in Settings, so they can
 * be un-hidden. */
export function getHiddenPeople(): PersonRecord[] {
  return getPeopleWhere(1)
}

export function createPerson(coverFaceId: string | null = null): PersonRecord {
  const id = crypto.randomUUID()
  getDb()
    .prepare('INSERT INTO people (id, name, cover_face_id, created_at) VALUES (?, NULL, ?, ?)')
    .run(id, coverFaceId, Date.now())
  const coverPhotoPath = coverFaceId
    ? ((
        getDb().prepare('SELECT photo_path FROM photo_faces WHERE id = ?').get(coverFaceId) as
          { photo_path: string } | undefined
      )?.photo_path ?? null)
    : null
  return {
    id,
    name: null,
    coverFaceId,
    coverPhotoPath,
    faceCount: coverFaceId ? 1 : 0,
    description: null
  }
}

export function renamePerson(id: string, name: string): void {
  getDb()
    .prepare('UPDATE people SET name = ? WHERE id = ?')
    .run(name.trim() || null, id)
}

export function setPersonDescription(id: string, description: string): void {
  getDb()
    .prepare('UPDATE people SET description = ? WHERE id = ?')
    .run(description.trim() || null, id)
}

/** Hides a person (filtered out of the People panel/gallery, but not
 * deleted) — pins every face currently assigned to them first, so this
 * exact grouping is frozen and a future rescan can never re-form it as a
 * new visible person. Distinct from deletePerson, which un-pins its faces
 * so they're free to be re-clustered. */
export function hidePerson(id: string): void {
  const db = getDb()
  db.prepare('UPDATE photo_faces SET person_id_pinned = 1 WHERE person_id = ?').run(id)
  db.prepare('UPDATE people SET hidden = 1 WHERE id = ?').run(id)
}

export function unhidePerson(id: string): void {
  getDb().prepare('UPDATE people SET hidden = 0 WHERE id = ?').run(id)
}

/** Assigns (and pins) a face to a person — the explicit "assign this photo
 * to this person" / drag-and-drop action. Mirrors setTagGroupAssignment's
 * always-pin-on-manual-write pattern. */
export function setFacePersonAssignment(faceId: string, personId: string): void {
  getDb()
    .prepare('UPDATE photo_faces SET person_id = ?, person_id_pinned = 1 WHERE id = ?')
    .run(personId, faceId)
}

/** "This is not the same person" — pulls one face out into its own new,
 * pinned person so it's never pulled back into the old cluster. */
export function splitFaceAsNewPerson(faceId: string): PersonRecord {
  const person = createPerson(faceId)
  setFacePersonAssignment(faceId, person.id)
  return person
}

/** "Not a person" / remove from this group without picking a new one —
 * pinned so automatic clustering doesn't immediately reassign it. */
export function unassignFace(faceId: string): void {
  getDb()
    .prepare('UPDATE photo_faces SET person_id = NULL, person_id_pinned = 1 WHERE id = ?')
    .run(faceId)
}

/** Moves every face from sourcePersonId onto targetPersonId (pinning them,
 * since this is a manual action) and removes the now-empty source person. */
export function mergePeople(sourcePersonId: string, targetPersonId: string): void {
  const db = getDb()
  db.prepare('UPDATE photo_faces SET person_id = ?, person_id_pinned = 1 WHERE person_id = ?').run(
    targetPersonId,
    sourcePersonId
  )
  db.prepare('DELETE FROM people WHERE id = ?').run(sourcePersonId)
}

/** Un-groups the person's faces (they become unpinned, so the next
 * clustering pass can re-group them) and deletes the person row — mirrors
 * deleteTagGroup's un-pin-on-delete behavior. */
export function deletePerson(id: string): void {
  const db = getDb()
  db.prepare(
    'UPDATE photo_faces SET person_id = NULL, person_id_pinned = 0 WHERE person_id = ?'
  ).run(id)
  db.prepare('DELETE FROM people WHERE id = ?').run(id)
}

export function deleteFacesForPhoto(photoPath: string): void {
  getDb().prepare('DELETE FROM photo_faces WHERE photo_path = ?').run(photoPath)
}

export function renameFacesForPhoto(oldPath: string, newPath: string): void {
  getDb()
    .prepare('UPDATE photo_faces SET photo_path = @newPath WHERE photo_path = @oldPath')
    .run({ oldPath, newPath })
}
