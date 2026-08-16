import type {
  SyncConflictRecord,
  SyncConflictResolutionRecord,
  SyncEntityVersionRecord,
  SyncRecoveryDraft,
  SyncResolutionAction
} from '~/types/syncConflict'

const DRAFT_PREFIX = 'testpapers.sync-recovery.v1:'

function draftKey (conflictId: string) {
  return `${DRAFT_PREFIX}${conflictId}`
}

function encodePath (value: string) {
  return encodeURIComponent(value)
}

function errorMessage (cause: unknown) {
  if (cause instanceof Error) return cause.message
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message
  return String(cause)
}

export function useSyncRecovery () {
  const { apiFetch } = useApi()
  const conflict = ref<SyncConflictRecord | null>(null)
  const versions = ref<SyncEntityVersionRecord[]>([])
  const resolutions = ref<SyncConflictResolutionRecord[]>([])
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')

  async function refreshHistory () {
    if (!conflict.value) return
    const entityType = encodePath(conflict.value.entityType)
    const entityId = encodePath(conflict.value.entityId)
    const conflictId = encodePath(conflict.value.conflictId)
    const [versionResponse, resolutionResponse] = await Promise.all([
      apiFetch<SyncEntityVersionRecord[]>(`/sync/entities/${entityType}/${entityId}/versions`),
      apiFetch<SyncConflictResolutionRecord[]>(`/sync/conflicts/${conflictId}/resolutions`)
    ])
    versions.value = versionResponse.data
    resolutions.value = resolutionResponse.data
  }

  async function load (conflictId: string) {
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      const response = await apiFetch<SyncConflictRecord>(`/sync/conflicts/${encodePath(conflictId)}`)
      if (response.data.origin !== 'personalSync') throw new Error('This recovery view only accepts personal Sync conflicts.')
      conflict.value = response.data
      await refreshHistory()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      busy.value = false
    }
  }

  function currentVersion () {
    const latest = versions.value[0]
    if (latest) return { version: latest.version, contentHash: latest.contentHash }
    if (!conflict.value) throw new Error('Conflict is not loaded.')
    return { version: conflict.value.cloud.version, contentHash: conflict.value.cloud.contentHash }
  }

  async function resolve (
    action: SyncResolutionAction,
    options: { payload?: Record<string, unknown>; restoreVersion?: number; undoesResolutionId?: string } = {}
  ) {
    if (!conflict.value) return null
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      const current = currentVersion()
      const body: Record<string, unknown> = {
        protocolVersion: 1,
        operationId: crypto.randomUUID(),
        action,
        currentVersion: current.version,
        currentContentHash: current.contentHash
      }
      if (action === 'manualMerge') body.payload = options.payload
      if (action === 'saveCopy') body.newEntityId = crypto.randomUUID()
      if (action === 'restoreVersion') body.payload = { version: options.restoreVersion }
      if (action === 'undo') body.undoesResolutionId = options.undoesResolutionId
      const response = await apiFetch<SyncConflictResolutionRecord>(
        `/sync/conflicts/${encodePath(conflict.value.conflictId)}/resolve`,
        { method: 'POST', body }
      )
      clearDraft(conflict.value.conflictId)
      await refreshHistory()
      notice.value = action === 'undo'
        ? 'The latest resolution was undone as a new auditable version.'
        : 'Resolution accepted as a new auditable version.'
      return response.data
    } catch (cause) {
      error.value = errorMessage(cause)
      return null
    } finally {
      busy.value = false
    }
  }

  function readDraft (conflictId: string): SyncRecoveryDraft | null {
    if (import.meta.server) return null
    try {
      const value = JSON.parse(localStorage.getItem(draftKey(conflictId)) ?? 'null') as SyncRecoveryDraft | null
      return value?.schemaVersion === 1 && value.conflictId === conflictId ? value : null
    } catch {
      return null
    }
  }

  function saveDraft (draft: SyncRecoveryDraft) {
    if (import.meta.client) localStorage.setItem(draftKey(draft.conflictId), JSON.stringify(draft))
  }

  function clearDraft (conflictId: string) {
    if (import.meta.client) localStorage.removeItem(draftKey(conflictId))
  }

  return { conflict, versions, resolutions, busy, error, notice, load, refreshHistory, resolve, readDraft, saveDraft, clearDraft }
}
