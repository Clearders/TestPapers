import type { ComputedRef, Ref } from 'vue'
import type { AuthUser } from '~/types/auth'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { ExamDraftSummary, GenerationFormState, PaperState, WorkspaceDraft } from '~/domain/papers'
import {
  buildExamDraftSummary,
  buildWorkspaceDraft,
  getExamDraftIndexKey,
  getExamDraftItemKey,
  getPaperSignature,
  getWorkspaceDraftKey,
  validateExamDraftSummary,
  validateWorkspaceDraft
} from '~/domain/papers'

export interface UseWorkspaceDraftParams {
  paper: PaperState
  generationForm: GenerationFormState
  exportMode: Ref<ExportMode>
  layoutDensity: Ref<LayoutDensity>
  includeAnswersInExport: Ref<boolean>
  canReadAnswers: ComputedRef<boolean>
  savedPaperId: Ref<string | null>
  savedPaperSignature: Ref<string>
  generationDiagnostics: Ref<GenerationDiagnostics | null>
  user: Ref<AuthUser | null>
}

export function useWorkspaceDraft (params: UseWorkspaceDraftParams) {
  const {
    paper,
    generationForm,
    exportMode,
    layoutDensity,
    includeAnswersInExport,
    canReadAnswers,
    savedPaperId,
    savedPaperSignature,
    generationDiagnostics,
    user
  } = params

  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
  const draftHydrated = ref(false)
  const suppressDraftSave = ref(false)
  const examDrafts = ref<ExamDraftSummary[]>([])
  const activeExamDraftId = ref<string | null>(null)
  const examDraftError = ref('')
  const examDraftSavedAt = ref<string | null>(null)
  let activeDraftKey = ''

  function currentDraftKey () {
    return getWorkspaceDraftKey(user.value?.id)
  }

  function currentExamDraftIndexKey () {
    return getExamDraftIndexKey(user.value?.id)
  }

  function currentExamDraftItemKey (id: string) {
    return getExamDraftItemKey(id, user.value?.id)
  }

  function currentPaperSignature () {
    return getPaperSignature(paper)
  }

  function createWorkspaceDraft () {
    return buildWorkspaceDraft({
      paper,
      generationForm,
      exportMode: exportMode.value,
      layoutDensity: layoutDensity.value,
      includeAnswersInExport: includeAnswersInExport.value && canReadAnswers.value,
      savedPaperId: savedPaperId.value,
      savedPaperSignature: savedPaperSignature.value,
      generationDiagnostics: generationDiagnostics.value
    })
  }

  function applyWorkspaceDraft (draft: WorkspaceDraft) {
    paper.title = draft.paper.title
    paper.subject = draft.paper.subject
    paper.duration = draft.paper.duration
    paper.totalMarks = draft.paper.totalMarks
    paper.questions.splice(0, paper.questions.length, ...draft.paper.questions)
    Object.assign(generationForm, draft.generationForm)
    exportMode.value = draft.exportMode
    layoutDensity.value = draft.layoutDensity
    includeAnswersInExport.value = draft.includeAnswersInExport && canReadAnswers.value
    generationDiagnostics.value = draft.generationDiagnostics

    savedPaperId.value = draft.savedPaperId
    savedPaperSignature.value = draft.savedPaperId ? draft.savedPaperSignature : ''
  }

  function restoreWorkspaceDraft () {
    const key = currentDraftKey()
    if (!key) return
    if (draftHydrated.value && activeDraftKey === key) return

    activeDraftKey = key
    draftHydrated.value = false
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const draft = validateWorkspaceDraft(JSON.parse(raw))
        if (draft) applyWorkspaceDraft(draft)
        else localStorage.removeItem(key)
      }
    } catch {
      localStorage.removeItem(key)
    } finally {
      draftHydrated.value = true
    }
  }

  function saveWorkspaceDraft (serializedDraft: string) {
    const key = currentDraftKey()
    if (!key) return
    activeDraftKey = key
    try {
      localStorage.setItem(key, serializedDraft)
    } catch {
      // Storage can be unavailable or full; the Workspace should remain usable.
    }
  }

  function clearWorkspaceDraft () {
    const key = activeDraftKey || currentDraftKey()
    if (!key) return
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore storage failures during local draft cleanup.
    }
  }

  function sortExamDrafts (drafts: ExamDraftSummary[]) {
    return [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  function persistExamDraftIndex (drafts: ExamDraftSummary[]) {
    localStorage.setItem(currentExamDraftIndexKey(), JSON.stringify(sortExamDrafts(drafts)))
  }

  function loadExamDraftSummaries () {
    if (!import.meta.client) return
    examDraftError.value = ''

    try {
      const raw = localStorage.getItem(currentExamDraftIndexKey())
      const parsed = raw ? JSON.parse(raw) : []
      const summaries = Array.isArray(parsed)
        ? parsed.map(validateExamDraftSummary).filter((draft): draft is ExamDraftSummary => draft !== null)
        : []
      examDrafts.value = sortExamDrafts(summaries)
    } catch {
      examDrafts.value = []
      localStorage.removeItem(currentExamDraftIndexKey())
    }
  }

  function createExamDraftId () {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  function saveExamDraft (name: string, draftId = activeExamDraftId.value) {
    if (!import.meta.client) return null
    examDraftError.value = ''

    try {
      const id = draftId || createExamDraftId()
      const existing = examDrafts.value.find(draft => draft.id === id)
      const draft = createWorkspaceDraft()
      const updatedAt = new Date().toISOString()
      const summary = buildExamDraftSummary(id, name || existing?.name || '', draft, updatedAt)
      const nextDrafts = sortExamDrafts([
        summary,
        ...examDrafts.value.filter(draft => draft.id !== id)
      ])

      localStorage.setItem(currentExamDraftItemKey(id), JSON.stringify(draft))
      persistExamDraftIndex(nextDrafts)
      examDrafts.value = nextDrafts
      activeExamDraftId.value = id
      examDraftSavedAt.value = updatedAt
      saveWorkspaceDraft(JSON.stringify(draft))
      return summary
    } catch {
      examDraftError.value = 'Could not save this exam draft in the browser.'
      return null
    }
  }

  function loadExamDraft (id: string) {
    if (!import.meta.client) return false
    examDraftError.value = ''

    try {
      const raw = localStorage.getItem(currentExamDraftItemKey(id))
      if (!raw) throw new Error('missing draft')
      const draft = validateWorkspaceDraft(JSON.parse(raw))
      if (!draft) throw new Error('invalid draft')
      applyWorkspaceDraft(draft)
      activeExamDraftId.value = id
      examDraftSavedAt.value = null
      saveWorkspaceDraft(JSON.stringify(draft))
      return true
    } catch {
      const nextDrafts = examDrafts.value.filter(draft => draft.id !== id)
      examDrafts.value = nextDrafts
      try {
        localStorage.removeItem(currentExamDraftItemKey(id))
        persistExamDraftIndex(nextDrafts)
      } catch {
        // Ignore cleanup failures after a failed load.
      }
      examDraftError.value = 'This exam draft could not be loaded and was removed from the list.'
      return false
    }
  }

  function deleteExamDraft (id: string) {
    if (!import.meta.client) return false
    examDraftError.value = ''

    try {
      const nextDrafts = examDrafts.value.filter(draft => draft.id !== id)
      localStorage.removeItem(currentExamDraftItemKey(id))
      persistExamDraftIndex(nextDrafts)
      examDrafts.value = nextDrafts
      if (activeExamDraftId.value === id) activeExamDraftId.value = null
      return true
    } catch {
      examDraftError.value = 'Could not delete this exam draft.'
      return false
    }
  }

  function clearActiveExamDraft () {
    activeExamDraftId.value = null
    examDraftSavedAt.value = null
  }

  function scheduleWorkspaceDraftSave () {
    if (!import.meta.client || !draftHydrated.value || suppressDraftSave.value) return
    if (draftSaveTimer) clearTimeout(draftSaveTimer)
    draftSaveTimer = setTimeout(() => {
      draftSaveTimer = null
      if (!draftHydrated.value || suppressDraftSave.value) return
      saveWorkspaceDraft(JSON.stringify(createWorkspaceDraft()))
    }, 300)
  }

  function clearDraftSaveTimer () {
    if (draftSaveTimer) clearTimeout(draftSaveTimer)
  }

  return {
    draftHydrated: readonly(draftHydrated),
    suppressDraftSave,
    examDrafts: readonly(examDrafts),
    activeExamDraftId,
    examDraftError: readonly(examDraftError),
    examDraftSavedAt: readonly(examDraftSavedAt),
    currentDraftKey,
    currentPaperSignature,
    createWorkspaceDraft,
    applyWorkspaceDraft,
    restoreWorkspaceDraft,
    loadExamDraftSummaries,
    saveExamDraft,
    loadExamDraft,
    deleteExamDraft,
    clearActiveExamDraft,
    saveWorkspaceDraft,
    clearWorkspaceDraft,
    scheduleWorkspaceDraftSave,
    clearDraftSaveTimer
  }
}
