import type { ComputedRef, Ref } from 'vue'
import type { AuthUser } from '~/types/auth'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { GenerationFormState, PaperState, WorkspaceDraft } from '~/domain/papers'
import {
  buildWorkspaceDraft,
  getPaperSignature,
  getWorkspaceDraftKey,
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
  let activeDraftKey = ''

  function currentDraftKey () {
    return getWorkspaceDraftKey(user.value?.id)
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

    const signatureMatches = Boolean(draft.savedPaperId && draft.savedPaperSignature && draft.savedPaperSignature === currentPaperSignature())
    savedPaperId.value = signatureMatches ? draft.savedPaperId : null
    savedPaperSignature.value = signatureMatches ? draft.savedPaperSignature : ''
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
    currentDraftKey,
    currentPaperSignature,
    createWorkspaceDraft,
    applyWorkspaceDraft,
    restoreWorkspaceDraft,
    saveWorkspaceDraft,
    clearWorkspaceDraft,
    scheduleWorkspaceDraftSave,
    clearDraftSaveTimer
  }
}
