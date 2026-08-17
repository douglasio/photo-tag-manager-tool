import type { AiScanPhase, FaceScanPhase } from '@shared/types'

// Shared by AiScanProgressToast and DuplicatesView so both surfaces describe
// the same multi-phase scan consistently — never the raw done/total numbers
// on their own, which for the 'clustering' phase used to read as an
// alarmingly large, confusing pair count.
export function aiScanStepLabel(phase: AiScanPhase): string {
  switch (phase) {
    case 'downloading':
      return 'Step 1 of 3: Downloading AI model'
    case 'embedding':
      return 'Step 2 of 3: Analyzing your photos'
    case 'clustering':
      return 'Step 3 of 3: Finding duplicates'
  }
}

// Shared by FaceScanProgressToast — same reasoning as aiScanStepLabel above.
export function faceScanStepLabel(phase: FaceScanPhase): string {
  switch (phase) {
    case 'detecting':
      return 'Step 1 of 2: Finding faces'
    case 'clustering':
      return 'Step 2 of 2: Grouping people'
  }
}
