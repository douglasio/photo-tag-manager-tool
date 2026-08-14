import { ipcMain } from 'electron'

import {
  deletePerson,
  getFacesForPhoto,
  getPeople,
  getPersonPhotoAssignments,
  mergePeople,
  renamePerson,
  setFacePersonAssignment,
  splitFaceAsNewPerson,
  unassignFace
} from '@main/db/faceRepository'
import {
  cancelFaceScan,
  enableFaceDetectionAndScan,
  runFullFaceScan
} from '@main/services/faceScanService'
import type { FaceRecord, FaceScanResult, PersonRecord } from '@shared/types'

export function registerFaceHandlers(): void {
  ipcMain.handle('faces:getForPhoto', (_event, filePath: string): FaceRecord[] =>
    getFacesForPhoto(filePath)
  )

  ipcMain.handle('faces:getPeople', (): PersonRecord[] => getPeople())

  // Feeds the gallery's filter-by-person lookup — see
  // PhotoLibraryContext's personPhotoAssignments.
  ipcMain.handle('faces:getPhotoAssignments', (): { photoPath: string; personId: string }[] =>
    getPersonPhotoAssignments()
  )

  // Enables the setting, then detects+clusters faces across the library —
  // triggerable from Settings, mirroring ai:enableAndScan.
  ipcMain.handle('faces:enableAndScan', async (event): Promise<FaceScanResult> => {
    return enableFaceDetectionAndScan((progress) =>
      event.sender.send('faces:scanProgress', progress)
    )
  })

  // Re-runs detection+clustering (face detection already enabled) — "Scan
  // again" once new photos have been added.
  ipcMain.handle('faces:rescan', async (event): Promise<FaceScanResult> => {
    return runFullFaceScan((progress) => event.sender.send('faces:scanProgress', progress))
  })

  ipcMain.handle('faces:cancelScan', (): void => {
    cancelFaceScan()
  })

  ipcMain.handle('faces:renamePerson', (_event, id: string, name: string): void => {
    renamePerson(id, name)
  })

  // "Assign this photo/face to this person" — drag-and-drop onto an
  // existing person, or the equivalent context-menu action.
  ipcMain.handle('faces:assignFaceToPerson', (_event, faceId: string, personId: string): void => {
    setFacePersonAssignment(faceId, personId)
  })

  // "This is not the same person" — pulls one face out into its own new person.
  ipcMain.handle('faces:splitFaceAsNewPerson', (_event, faceId: string): PersonRecord =>
    splitFaceAsNewPerson(faceId)
  )

  ipcMain.handle('faces:unassignFace', (_event, faceId: string): void => {
    unassignFace(faceId)
  })

  ipcMain.handle(
    'faces:mergePeople',
    (_event, sourcePersonId: string, targetPersonId: string): void => {
      mergePeople(sourcePersonId, targetPersonId)
    }
  )

  ipcMain.handle('faces:deletePerson', (_event, id: string): void => {
    deletePerson(id)
  })
}
