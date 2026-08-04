import type {
  DraftCollaboratorRole,
  DraftCommentStatus,
  DraftReviewStatus,
  SharedDraft,
  SharedDraftCreatePayload,
  SharedDraftSummary,
  SharedDraftUpdatePayload
} from '~/types/draft'
import type { WorkspaceDraft } from '~/domain/papers'
import {
  DOCX_CONTENT_TYPE,
  TEX_CONTENT_TYPE,
  filenameFromDisposition,
  validateWorkspaceDraft
} from '~/domain/papers'
import {
  applySharedDraftDeleted,
  canCommentOnSharedDraft,
  canEditSharedDraft,
  canManageSharedDraft,
  hasSharedDraftChanges
} from '~/domain/drafts'
import { apiErrorMessage, getStatusCode } from '~/utils/apiError'

export interface UseSharedDraftsParams {
  createWorkspaceDraft: () => WorkspaceDraft
  applyWorkspaceDraft: (draft: WorkspaceDraft) => void
  defaultDraftName: () => string
  onDraftLoaded?: () => void
}

function summaryFromDraft (draft: SharedDraft): SharedDraftSummary {
  return {
    id: draft.id,
    publicId: draft.publicId,
    name: draft.name,
    owner: draft.owner,
    accessRole: draft.accessRole,
    reviewStatus: draft.reviewStatus,
    revision: draft.revision,
    collaboratorCount: draft.collaboratorCount,
    commentCount: draft.commentCount,
    openCommentCount: draft.openCommentCount,
    updatedBy: draft.updatedBy,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }
}

function sortSummaries (drafts: SharedDraftSummary[]) {
  return [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function useSharedDrafts (params: UseSharedDraftsParams) {
  const { createWorkspaceDraft, applyWorkspaceDraft, defaultDraftName, onDraftLoaded } = params
  const { apiFetch, apiFetchRaw } = useApi()

  const cloudDrafts = ref<SharedDraftSummary[]>([])
  const activeCloudDraft = ref<SharedDraft | null>(null)
  const selectedCloudDraftId = ref('')
  const cloudDraftName = ref('')
  const cloudDraftError = ref('')
  const cloudDraftSavedAt = ref<string | null>(null)
  const cloudDraftConflict = ref(false)
  const isLoadingCloudDrafts = ref(false)
  const isSavingCloudDraft = ref(false)
  const isDownloadingCloudDraft = ref(false)

  const selectedCloudDraft = computed(() => cloudDrafts.value.find(draft => draft.publicId === selectedCloudDraftId.value) || null)
  const canManageActiveCloudDraft = computed(() => canManageSharedDraft(activeCloudDraft.value))
  const canEditActiveCloudDraft = computed(() => canEditSharedDraft(activeCloudDraft.value))
  const canCommentActiveCloudDraft = computed(() => canCommentOnSharedDraft(activeCloudDraft.value) && !cloudDraftConflict.value)
  const hasActiveCloudDraftChanges = computed(() => hasSharedDraftChanges(createWorkspaceDraft(), activeCloudDraft.value?.state))

  function resetCloudDraftStatus () {
    cloudDraftError.value = ''
    cloudDraftConflict.value = false
  }

  function blockStaleMutation (message: string) {
    if (!cloudDraftConflict.value) return false
    cloudDraftError.value = message
    return true
  }

  function rememberDraft (draft: SharedDraft) {
    activeCloudDraft.value = draft
    cloudDraftName.value = draft.name
    selectedCloudDraftId.value = draft.publicId
    const summary = summaryFromDraft(draft)
    cloudDrafts.value = sortSummaries([
      summary,
      ...cloudDrafts.value.filter(item => item.publicId !== summary.publicId)
    ])
  }

  function clearActiveCloudDraft () {
    activeCloudDraft.value = null
    selectedCloudDraftId.value = ''
    cloudDraftName.value = ''
    cloudDraftSavedAt.value = null
    cloudDraftConflict.value = false
  }

  function removeDeletedCloudDraft (draftId: string, message = 'This cloud draft was deleted elsewhere.') {
    const result = applySharedDraftDeleted(
      {
        drafts: cloudDrafts.value,
        activeDraft: activeCloudDraft.value,
        selectedDraftId: selectedCloudDraftId.value
      },
      draftId
    )

    cloudDrafts.value = result.drafts
    activeCloudDraft.value = result.activeDraft
    selectedCloudDraftId.value = result.selectedDraftId

    if (result.deletedActive) {
      cloudDraftName.value = ''
      cloudDraftSavedAt.value = null
      cloudDraftConflict.value = false
    }
    if (message && (result.deletedActive || result.deletedSelected)) {
      cloudDraftError.value = message
    }

    return result
  }

  async function loadCloudDrafts () {
    resetCloudDraftStatus()
    isLoadingCloudDrafts.value = true
    try {
      const response = await apiFetch<SharedDraftSummary[]>('/drafts')
      cloudDrafts.value = sortSummaries(response.data)
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to load cloud drafts.')
    } finally {
      isLoadingCloudDrafts.value = false
    }
  }

  async function createCloudDraft (name = cloudDraftName.value) {
    resetCloudDraftStatus()
    isSavingCloudDraft.value = true
    try {
      const payload: SharedDraftCreatePayload = {
        name: name.trim() || defaultDraftName(),
        state: createWorkspaceDraft()
      }
      const response = await apiFetch<SharedDraft>('/drafts', {
        method: 'POST',
        body: payload
      })
      rememberDraft(response.data)
      cloudDraftSavedAt.value = response.data.updatedAt
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to create cloud draft.')
      return null
    } finally {
      isSavingCloudDraft.value = false
    }
  }

  async function loadCloudDraft (draftId = selectedCloudDraftId.value) {
    if (!draftId) return null
    resetCloudDraftStatus()
    isLoadingCloudDrafts.value = true
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${draftId}`)
      const draft = validateWorkspaceDraft(response.data.state)
      if (!draft) throw new Error('Cloud draft state is invalid.')
      applyWorkspaceDraft(draft)
      rememberDraft({ ...response.data, state: draft })
      cloudDraftSavedAt.value = null
      onDraftLoaded?.()
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to load cloud draft.')
      return null
    } finally {
      isLoadingCloudDrafts.value = false
    }
  }

  async function patchActiveCloudDraft (patch: Omit<SharedDraftUpdatePayload, 'baseRevision'>, fallback: string) {
    if (!activeCloudDraft.value) return await createCloudDraft()
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest or save as a new cloud draft before editing it.')) return null
    resetCloudDraftStatus()
    isSavingCloudDraft.value = true
    try {
      const payload: SharedDraftUpdatePayload = {
        baseRevision: activeCloudDraft.value.revision,
        ...patch
      }
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}`, {
        method: 'PATCH',
        body: payload
      })
      rememberDraft(response.data)
      cloudDraftSavedAt.value = response.data.updatedAt
      return response.data
    } catch (error) {
      if (getStatusCode(error) === 409) cloudDraftConflict.value = true
      cloudDraftError.value = apiErrorMessage(error, fallback)
      return null
    } finally {
      isSavingCloudDraft.value = false
    }
  }

  async function saveActiveCloudDraft () {
    const patch: Omit<SharedDraftUpdatePayload, 'baseRevision'> = {
      state: createWorkspaceDraft()
    }
    if (!activeCloudDraft.value || canManageActiveCloudDraft.value) {
      patch.name = cloudDraftName.value.trim() || activeCloudDraft.value?.name || defaultDraftName()
    }
    return await patchActiveCloudDraft(patch, 'Failed to save cloud draft.')
  }

  async function saveActiveCloudDraftAsNew () {
    const baseName = cloudDraftName.value.trim() || activeCloudDraft.value?.name || defaultDraftName()
    const copyName = activeCloudDraft.value ? `${baseName} copy` : baseName
    return await createCloudDraft(copyName)
  }

  async function setCloudDraftReviewStatus (reviewStatus: DraftReviewStatus) {
    return await patchActiveCloudDraft({ reviewStatus }, 'Failed to update review status.')
  }

  async function deleteSelectedCloudDraft () {
    const draftId = selectedCloudDraftId.value
    if (!draftId) return false
    resetCloudDraftStatus()
    isSavingCloudDraft.value = true
    try {
      await apiFetch(`/drafts/${draftId}`, { method: 'DELETE' })
      removeDeletedCloudDraft(draftId, '')
      return true
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to delete cloud draft.')
      return false
    } finally {
      isSavingCloudDraft.value = false
    }
  }

  async function addCloudDraftCollaborator (username: string, role: DraftCollaboratorRole) {
    if (!activeCloudDraft.value) return null
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest before changing collaborators.')) return null
    resetCloudDraftStatus()
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}/collaborators`, {
        method: 'POST',
        body: { username, role }
      })
      rememberDraft(response.data)
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to update collaborator.')
      return null
    }
  }

  async function updateCloudDraftCollaborator (userPublicId: string, role: DraftCollaboratorRole) {
    if (!activeCloudDraft.value) return null
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest before changing collaborators.')) return null
    resetCloudDraftStatus()
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}/collaborators/${userPublicId}`, {
        method: 'PATCH',
        body: { role }
      })
      rememberDraft(response.data)
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to update collaborator.')
      return null
    }
  }

  async function removeCloudDraftCollaborator (userPublicId: string) {
    if (!activeCloudDraft.value) return null
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest before changing collaborators.')) return null
    resetCloudDraftStatus()
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}/collaborators/${userPublicId}`, {
        method: 'DELETE'
      })
      rememberDraft(response.data)
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to remove collaborator.')
      return null
    }
  }

  async function addCloudDraftComment (message: string, questionPublicId?: string | null) {
    if (!activeCloudDraft.value) return null
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest before commenting.')) return null
    resetCloudDraftStatus()
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}/comments`, {
        method: 'POST',
        body: { message, ...(questionPublicId ? { questionPublicId } : {}) }
      })
      rememberDraft(response.data)
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to add comment.')
      return null
    }
  }

  async function updateCloudDraftComment (commentPublicId: string, patch: { message?: string, status?: DraftCommentStatus }) {
    if (!activeCloudDraft.value) return null
    if (blockStaleMutation('This cloud draft changed elsewhere. Load latest before changing comments.')) return null
    resetCloudDraftStatus()
    try {
      const response = await apiFetch<SharedDraft>(`/drafts/${activeCloudDraft.value.publicId}/comments/${commentPublicId}`, {
        method: 'PATCH',
        body: patch
      })
      rememberDraft(response.data)
      return response.data
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to update comment.')
      return null
    }
  }

  async function downloadCloudDraft (format: 'docx' | 'tex') {
    if (!activeCloudDraft.value || isDownloadingCloudDraft.value) return false
    resetCloudDraftStatus()
    isDownloadingCloudDraft.value = true
    try {
      const response = await apiFetchRaw(`/drafts/${activeCloudDraft.value.publicId}/download`, {
        method: 'GET',
        query: { format }
      })
      const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase()
      const expectedContentType = format === 'docx' ? DOCX_CONTENT_TYPE : TEX_CONTENT_TYPE
      if (contentType !== expectedContentType) throw new Error(`The cloud draft download did not return a ${format.toUpperCase()} file.`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filenameFromDisposition(response.headers.get('Content-Disposition'), activeCloudDraft.value.name, format)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      return true
    } catch (error) {
      cloudDraftError.value = apiErrorMessage(error, 'Failed to download cloud draft.')
      return false
    } finally {
      isDownloadingCloudDraft.value = false
    }
  }

  async function downloadCloudDraftDocx () {
    return await downloadCloudDraft('docx')
  }

  async function downloadCloudDraftTex () {
    return await downloadCloudDraft('tex')
  }

  return {
    cloudDrafts,
    activeCloudDraft,
    selectedCloudDraft,
    selectedCloudDraftId,
    cloudDraftName,
    cloudDraftError,
    cloudDraftSavedAt,
    cloudDraftConflict,
    isLoadingCloudDrafts,
    isSavingCloudDraft,
    isDownloadingCloudDraft,
    canManageActiveCloudDraft,
    canEditActiveCloudDraft,
    canCommentActiveCloudDraft,
    hasActiveCloudDraftChanges,
    clearActiveCloudDraft,
    removeDeletedCloudDraft,
    loadCloudDrafts,
    createCloudDraft,
    loadCloudDraft,
    saveActiveCloudDraft,
    saveActiveCloudDraftAsNew,
    setCloudDraftReviewStatus,
    deleteSelectedCloudDraft,
    addCloudDraftCollaborator,
    updateCloudDraftCollaborator,
    removeCloudDraftCollaborator,
    addCloudDraftComment,
    updateCloudDraftComment,
    downloadCloudDraftDocx,
    downloadCloudDraftTex
  }
}
