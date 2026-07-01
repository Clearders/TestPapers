import type { Ref } from 'vue'
import type { ExamDraftSummary } from '~/domain/papers'

export interface UseExamDraftControlsParams {
  examDrafts: Readonly<Ref<readonly ExamDraftSummary[]>>
  activeExamDraftId: Ref<string | null>
  hasCurrentDraftContent: Readonly<Ref<boolean>>
  defaultDraftName: () => string
  saveExamDraft: (name: string) => ExamDraftSummary | null
  loadExamDraft: (id: string) => boolean
  deleteExamDraft: (id: string) => boolean
  onDraftLoaded?: () => void
}

export function useExamDraftControls (params: UseExamDraftControlsParams) {
  const {
    examDrafts,
    activeExamDraftId,
    hasCurrentDraftContent,
    defaultDraftName,
    saveExamDraft,
    loadExamDraft,
    deleteExamDraft,
    onDraftLoaded
  } = params

  const examDraftName = ref('')
  const selectedExamDraftId = ref('')

  const activeExamDraftName = computed(() => examDrafts.value.find(draft => draft.id === activeExamDraftId.value)?.name || '')
  const selectedExamDraft = computed(() => examDrafts.value.find(draft => draft.id === selectedExamDraftId.value) || null)
  const examDraftSummaryText = computed(() => {
    if (!examDrafts.value.length) return 'No saved exam drafts yet.'
    return `${examDrafts.value.length} saved draft${examDrafts.value.length === 1 ? '' : 's'} on this device.`
  })

  watch(examDrafts, (drafts) => {
    if (selectedExamDraftId.value && !drafts.some(draft => draft.id === selectedExamDraftId.value)) {
      selectedExamDraftId.value = ''
    }
  })

  function resetExamDraftSelection () {
    examDraftName.value = ''
    selectedExamDraftId.value = ''
  }

  function saveCurrentExamDraft () {
    const summary = saveExamDraft(examDraftName.value || defaultDraftName())
    if (!summary) return
    examDraftName.value = summary.name
    selectedExamDraftId.value = summary.id
  }

  function loadSelectedExamDraft () {
    const draft = selectedExamDraft.value
    if (!draft) return
    if (hasCurrentDraftContent.value && !window.confirm(`Load "${draft.name}" and replace the current paper?`)) return
    if (!loadExamDraft(draft.id)) return
    examDraftName.value = draft.name
    selectedExamDraftId.value = draft.id
    onDraftLoaded?.()
  }

  function deleteSelectedExamDraft () {
    const draft = selectedExamDraft.value
    if (!draft) return
    if (!window.confirm(`Delete "${draft.name}"? This cannot be undone.`)) return
    const wasActive = activeExamDraftId.value === draft.id
    deleteExamDraft(draft.id)
    if (selectedExamDraftId.value === draft.id) selectedExamDraftId.value = ''
    if (wasActive) examDraftName.value = ''
  }

  return {
    examDraftName,
    selectedExamDraftId,
    activeExamDraftName,
    selectedExamDraft,
    examDraftSummaryText,
    resetExamDraftSelection,
    saveCurrentExamDraft,
    loadSelectedExamDraft,
    deleteSelectedExamDraft
  }
}
