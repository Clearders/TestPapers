<template>
  <section class="workspace">
    <WorkspaceHeading
      :selected-count="paper.questions.length"
      :total-marks="paper.totalMarks"
    />

    <WorkspaceSectionTabs v-model:active-section="activeSection" />

    <Transition name="fade" mode="out-in">
      <div v-if="activeSection === 'editor'" key="editor" class="workspace-section editor-section">
        <WorkspaceEditorToolbar
          @new-paper="newPaper"
          @open-bank="setActiveSection('bank')"
        />

        <ExamDraftPanel
          v-model:draft-name="examDraftName"
          v-model:selected-draft-id="selectedExamDraftId"
          :summary-text="examDraftSummaryText"
          :active-draft-name="activeExamDraftName"
          :drafts="examDrafts"
          :selected-draft="selectedExamDraft"
          :saved-at="examDraftSavedAt"
          :error="examDraftError"
          :has-current-draft-content="hasCurrentDraftContent"
          @save="saveCurrentExamDraft"
          @load="loadSelectedExamDraft"
          @delete-draft="deleteSelectedExamDraft"
        />

        <div class="editor-layout">
          <PaperBuilderPanel
            v-model:export-mode="exportMode"
            v-model:layout-density="layoutDensity"
            v-model:include-answers-in-export="includeAnswersInExport"
            :paper="paper"
            :generation-form="generationForm"
            :can-read-answers="canReadAnswers"
            :can-write-papers="canWritePapers"
            :is-generating="isGenerating"
            :generation-error="generationError"
            :generation-diagnostics="generationDiagnostics"
            :available-subjects="availableSubjects"
            :available-tags="availableTags"
            :is-loading-meta="isLoadingMeta"
            :exported="exported"
            :is-downloading-docx="isDownloadingDocx"
            :download-error="downloadError"
            :is-saving-paper="isSavingPaper"
            :save-error="saveError"
            :save-success="saveSuccess"
            :downloaded-layout-density="downloadedLayoutDensity"
            :can-download-docx="canDownloadDocx"
            :export-access-prompt="exportAccessPrompt"
            :show-inline-export-preview="false"
            @update:paper-title="paper.title = $event"
            @update:paper-subject="paper.subject = $event"
            @update:paper-duration="paper.duration = $event"
            @update:generation-form="Object.assign(generationForm, $event)"
            @update:total-marks="paper.totalMarks = $event"
            @generate="generatePaper"
            @move-up="moveUp"
            @move-down="moveDown"
            @remove-question="removeQuestion"
            @edit-temporary-question="openTemporaryQuestionEdit"
            @reset-temporary-question="resetTemporaryQuestionEdit"
            @save-paper="savePaper"
            @export-paper="exportPaper"
            @download-docx="downloadDocx"
            @clear-paper="clearPaper"
            @dismiss-export-access-prompt="dismissExportAccessPrompt"
          />

          <PaperLivePreview
            v-model:export-mode="exportMode"
            v-model:layout-density="layoutDensity"
            v-model:include-answers-in-export="includeAnswersInExport"
            :paper="paper"
            :can-read-answers="canReadAnswers"
            :downloaded-layout-density="downloadedLayoutDensity"
            :fullscreen="previewFullscreen"
            @toggle-fullscreen="previewFullscreen = !previewFullscreen"
            @print-paper="printPaper"
          />
        </div>
      </div>

      <div v-else key="bank" class="workspace-section">
        <QuestionBankPanel
          v-if="canReadQuestions"
          v-model:search="search"
          v-model:filter-subject="filterSubject"
          v-model:filter-difficulty="filterDifficulty"
          v-model:filter-type="filterType"
          v-model:filter-tag="filterTag"
          v-model:filter-has-latex="filterHasLatex"
          :bank-mode="bankMode"
          :available-subjects="availableSubjects"
          :available-tags="availableTags"
          :can-create-questions="canCreateQuestions"
          :current-questions="currentQuestions"
          :active-pagination="activePagination"
          :active-loading="activeLoading"
          :question-error="questionError"
          :shown-ids="shownIds"
          :paper-question-ids="paperQuestionIds"
          :can-read-answers="canReadAnswers"
          :can-review="canReview"
          :can-delete-question="canDeleteQuestion"
          :can-edit-question="canEditQuestion"
          @switch-bank-mode="switchBankMode"
          @toggle-question="toggleQuestion"
          @view-detail="openDetailModal"
          @edit="openEditModal"
          @report="openCorrectionModal"
          @delete="onDeleteQuestionFromCard"
          @page-change="goToPage"
          @toggle-answer="onToggleAnswer"
          @open-import="importModalOpen = true"
          @reset-filters="resetFilters"
        />
        <WorkspaceAccessPrompt
          v-else
          :title="workspaceAccessTitle"
          :message="workspaceAccessMessage"
          :is-authenticated="isAuthenticated"
        />
      </div>
    </Transition>

    <EditQuestionModal
      v-if="editingQuestion"
      :key="editingQuestion.id"
      :question="editingQuestion"
      :visible="!!editingQuestion"
      @close="closeEditModal"
      @saved="onQuestionEdited"
    />

    <QuestionCorrectionModal
      v-if="reportingQuestion"
      :key="reportingQuestion.id"
      :question="reportingQuestion"
      :visible="!!reportingQuestion"
      @close="closeCorrectionModal"
    />

    <QuestionDetailModal
      v-if="detailQuestion"
      :key="detailQuestion.id"
      :question="detailQuestion"
      :can-read-answers="canReadAnswers"
      @close="detailQuestion = null"
    />

    <QuestionImportModal
      v-if="importModalOpen"
      :can-create-questions="canCreateQuestions"
      @close="importModalOpen = false"
      @imported="onQuestionsImported"
    />

    <TemporaryQuestionEditModal
      v-if="temporaryEditingQuestion"
      :key="temporaryEditingQuestion.id"
      :question="temporaryEditingQuestion"
      :visible="!!temporaryEditingQuestion"
      @close="temporaryEditingQuestion = null"
      @save="applyTemporaryQuestionEdit"
      @reset="resetTemporaryQuestionEdit"
    />
  </section>
</template>

<script setup lang="ts">
import type { Question, QuestionDifficulty, QuestionType } from '~/types/question'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { BankMode, GeneratedPaperResponse, PaperQuestion } from '~/domain/papers'
import {
  buildPaperGeneratePayload,
  clonePaperQuestion,
  createDefaultGenerationForm,
  createDefaultPaper,
  parseBankMode,
  parseQuestionDifficulty
} from '~/domain/papers'
import { QUESTION_TYPE_ORDER } from '~/domain/questions'
import { apiErrorMessage } from '~/utils/apiError'

type WorkspaceSection = 'editor' | 'bank'

const EditQuestionModal = defineAsyncComponent(() => import('~/components/questions/EditQuestionModal.vue'))
const QuestionCorrectionModal = defineAsyncComponent(() => import('~/components/questions/QuestionCorrectionModal.vue'))
const QuestionDetailModal = defineAsyncComponent(() => import('~/components/questions/QuestionDetailModal.vue'))
const QuestionImportModal = defineAsyncComponent(() => import('~/components/questions/QuestionImportModal.vue'))
const TemporaryQuestionEditModal = defineAsyncComponent(() => import('~/components/TemporaryQuestionEditModal.vue'))

const {
  canCreateQuestions,
  canReadAnswers,
  questions,
  myQuestions,
  loadQuestions,
  loadMyQuestions,
  isLoading,
  isLoadingMine,
  error: questionError,
  questionPagination,
  myQuestionPagination,
  availableSubjects,
  availableTags,
  loadMeta,
  isLoadingMeta
} = useQuestionBank()
const { hasPermission, isAuthenticated, isAuthReady, user } = useAuth()
const { apiFetch, apiFetchRaw } = useApi()
const route = useRoute()
const router = useRouter()

function parseQuerySubject (): string {
  const raw = route.query.subjects
  return typeof raw === 'string' ? raw : ''
}

function parseQueryTag (): string {
  const raw = route.query.tags
  return typeof raw === 'string' ? raw : ''
}

function parseWorkspaceSection (value: unknown): WorkspaceSection {
  return value === 'bank' ? 'bank' : 'editor'
}

function parseQuestionTypeFilter (value: unknown): QuestionType | '' {
  return typeof value === 'string' && QUESTION_TYPE_ORDER.includes(value as QuestionType) ? value as QuestionType : ''
}

function parseLatexFilter (value: unknown): '' | 'true' | 'false' {
  return value === 'true' || value === 'false' ? value : ''
}

const activeSection = ref<WorkspaceSection>(parseWorkspaceSection(route.query.section))
const search = ref((route.query.q as string) || '')
const filterSubject = ref(parseQuerySubject())
const filterDifficulty = ref<QuestionDifficulty | ''>(parseQuestionDifficulty(route.query.difficulty))
const filterType = ref<QuestionType | ''>(parseQuestionTypeFilter(route.query.type))
const filterTag = ref(parseQueryTag())
const filterHasLatex = ref<'' | 'true' | 'false'>(parseLatexFilter(route.query.hasLatex))
const shownIds = reactive(new Set<number>())
const exportMode = ref<ExportMode>('paper')
const layoutDensity = ref<LayoutDensity>('auto')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>(parseBankMode(route.query.bank))
const pageSize = ref(20)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)
const isActive = ref(true)
const previewFullscreen = ref(false)
const importModalOpen = ref(false)
const examDraftName = ref('')
const selectedExamDraftId = ref('')
let searchLoadTimer: ReturnType<typeof setTimeout> | null = null

const paper = reactive(createDefaultPaper())
const generationForm = reactive(createDefaultGenerationForm())

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)
const detailQuestion = ref<Question | null>(null)
const temporaryEditingQuestion = ref<PaperQuestion | null>(null)

const canReadQuestions = computed(() => hasPermission('questions:read'))
const workspaceAccessTitle = computed(() => isAuthenticated.value ? 'Question bank access required' : 'Create an account to use the question bank')
const workspaceAccessMessage = computed(() => (
  isAuthenticated.value
    ? 'Your account can open the workspace, but it does not have permission to read the question bank. Contact the administrator for access.'
    : 'You can prepare paper details in the editor. Create an account to search questions, build papers from the bank, and export exam papers.'
))
const isAdmin = computed(() => hasPermission('users:manage'))
const canReview = computed(() => hasPermission('questions:write'))

function canEditQuestion (q: Question) {
  if (!hasPermission('questions:write')) return false
  if (isAdmin.value) return true
  return q.ownerId === null || q.ownerId === user.value?.id
}

function canDeleteQuestion (q: Question) {
  if (!hasPermission('questions:delete')) return false
  if (isAdmin.value) return true
  return q.ownerId === null || q.ownerId === user.value?.id
}

const currentQuestions = computed(() => bankMode.value === 'mine' ? myQuestions.value : questions.value)
const activePagination = computed(() => bankMode.value === 'mine' ? myQuestionPagination.value : questionPagination.value)
const activeLoading = computed(() => bankMode.value === 'mine' ? isLoadingMine.value : isLoading.value)

const paperQuestionIds = computed(() => {
  const ids = new Set<number>()
  for (const q of paper.questions) ids.add(q.id)
  return ids
})
const hasCurrentDraftContent = computed(() => Boolean(
  paper.title.trim() ||
  paper.subject.trim() ||
  paper.questions.length ||
  generationForm.subjects.length ||
  generationForm.requiredTags.length ||
  generationForm.preferredTags.length
))

const savedPaperId = ref<string | null>(null)
const savedPaperSignature = ref('')

const {
  suppressDraftSave,
  examDrafts,
  activeExamDraftId,
  examDraftError,
  examDraftSavedAt,
  currentPaperSignature,
  restoreWorkspaceDraft,
  loadExamDraftSummaries,
  saveExamDraft,
  loadExamDraft,
  deleteExamDraft,
  clearActiveExamDraft,
  clearWorkspaceDraft,
  scheduleWorkspaceDraftSave,
  clearDraftSaveTimer
} = useWorkspaceDraft({
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
})

const activeExamDraftName = computed(() => examDrafts.value.find(draft => draft.id === activeExamDraftId.value)?.name || '')
const selectedExamDraft = computed(() => examDrafts.value.find(draft => draft.id === selectedExamDraftId.value) || null)
const examDraftSummaryText = computed(() => {
  if (!examDrafts.value.length) return 'No saved exam drafts yet.'
  return `${examDrafts.value.length} saved draft${examDrafts.value.length === 1 ? '' : 's'} on this device.`
})

const {
  exported,
  exportAccessPrompt,
  isDownloadingDocx,
  isSavingPaper,
  downloadError,
  saveError,
  saveSuccess,
  downloadedLayoutDensity,
  canWritePapers,
  canDownloadDocx,
  dismissExportAccessPrompt,
  exportPaper,
  printPaper,
  savePaper,
  downloadDocx,
  resetExportState,
  applyGenerationResult
} = usePaperExport({
  paper,
  exportMode,
  layoutDensity,
  includeAnswersInExport,
  canReadAnswers,
  isAuthenticated,
  savedPaperId,
  savedPaperSignature,
  currentPaperSignature,
  hasPermission,
  apiFetch,
  apiFetchRaw
})

watch(
  [isAuthReady, canReadQuestions],
  ([ready, allowed]) => {
    if (!import.meta.client || !ready) return
    restoreWorkspaceDraft()
    loadExamDraftSummaries()
    if (allowed) {
      void loadCurrentPage(1)
      void loadMeta()
    }
  },
  { immediate: true }
)

watch([search, filterSubject, filterDifficulty, filterType, filterTag, filterHasLatex], () => {
  if (import.meta.client) {
    syncQuery()
    if (searchLoadTimer) clearTimeout(searchLoadTimer)
    searchLoadTimer = setTimeout(() => {
      searchLoadTimer = null
      if (isActive.value && canReadQuestions.value) void loadCurrentPage(1)
    }, 250)
  }
})

watch([bankMode, activeSection], () => {
  if (import.meta.client) syncQuery()
})

watch(examDrafts, (drafts) => {
  if (selectedExamDraftId.value && !drafts.some(draft => draft.id === selectedExamDraftId.value)) {
    selectedExamDraftId.value = ''
  }
})

onBeforeUnmount(() => {
  isActive.value = false
  if (searchLoadTimer) clearTimeout(searchLoadTimer)
  clearDraftSaveTimer()
})

function syncQuery () {
  if (!isActive.value) return
  const query: Record<string, string> = {}
  const q = search.value.trim()
  if (activeSection.value !== 'editor') query.section = activeSection.value
  if (q) query.q = q
  if (filterSubject.value) query.subjects = filterSubject.value
  if (filterDifficulty.value) query.difficulty = filterDifficulty.value
  if (filterType.value) query.type = filterType.value
  if (filterTag.value) query.tags = filterTag.value
  if (filterHasLatex.value) query.hasLatex = filterHasLatex.value
  if (bankMode.value !== 'all') query.bank = bankMode.value
  void router.replace({ query })
}

watch(canReadAnswers, (allowed) => {
  if (!allowed) includeAnswersInExport.value = false
})

function setActiveSection (section: WorkspaceSection) {
  activeSection.value = section
}

function resetFilters () {
  search.value = ''
  filterSubject.value = ''
  filterDifficulty.value = ''
  filterType.value = ''
  filterTag.value = ''
  filterHasLatex.value = ''
}

async function switchBankMode (mode: BankMode) {
  bankMode.value = mode
  await loadCurrentPage(1)
}

function currentQuery (page: number) {
  return {
    q: search.value.trim() || undefined,
    subjects: filterSubject.value || undefined,
    difficulty: (filterDifficulty.value || undefined) as Question['difficulty'] | undefined,
    type: filterType.value || undefined,
    tags: filterTag.value || undefined,
    hasLatex: filterHasLatex.value ? filterHasLatex.value === 'true' : undefined,
    page,
    pageSize: pageSize.value,
    sortBy: 'createdAt',
    sortOrder: 'desc' as const
  }
}

async function loadCurrentPage (page: number) {
  if (bankMode.value === 'mine') {
    await loadMyQuestions(currentQuery(page))
    return
  }
  await loadQuestions(currentQuery(page))
}

function goToPage (page: number) {
  void loadCurrentPage(page)
}

function toggleQuestion (question: Question) {
  if (paperQuestionIds.value.has(question.id)) {
    removeQuestion(question.id)
    return
  }
  paper.questions.push(clonePaperQuestion(question))
}

function onToggleAnswer (id: number) {
  if (shownIds.has(id)) shownIds.delete(id)
  else shownIds.add(id)
}

function removeQuestion (id: number) {
  const idx = paper.questions.findIndex(q => q.id === id)
  if (idx !== -1) paper.questions.splice(idx, 1)
}

function onDeleteQuestionFromCard (question: Question) {
  removeQuestion(question.id)
}

function moveUp (idx: number) {
  if (idx === 0 || idx >= paper.questions.length) return
  const [removed] = paper.questions.splice(idx, 1)
  if (!removed) return
  paper.questions.splice(idx - 1, 0, removed)
}

function moveDown (idx: number) {
  if (idx >= paper.questions.length - 1) return
  const [removed] = paper.questions.splice(idx, 1)
  if (!removed) return
  paper.questions.splice(idx + 1, 0, removed)
}

function openTemporaryQuestionEdit (question: PaperQuestion) {
  temporaryEditingQuestion.value = question
}

function applyTemporaryQuestionEdit (question: PaperQuestion) {
  const idx = paper.questions.findIndex(item => item.id === question.id)
  if (idx === -1) return
  paper.questions.splice(idx, 1, question)
  temporaryEditingQuestion.value = null
  downloadedLayoutDensity.value = null
}

function resetTemporaryQuestionEdit (id: number) {
  const idx = paper.questions.findIndex(item => item.id === id)
  if (idx === -1) return
  const current = paper.questions[idx]
  if (!current?.originalQuestion) return
  const restored = clonePaperQuestion(current.originalQuestion)
  restored.marks = current.marks
  restored.orderNo = current.orderNo
  paper.questions.splice(idx, 1, restored)
  if (temporaryEditingQuestion.value?.id === id) temporaryEditingQuestion.value = null
  downloadedLayoutDensity.value = null
}

function clearPaper () {
  if (!window.confirm('Clear all questions from the paper? This cannot be undone.')) return
  suppressDraftSave.value = true
  paper.questions.length = 0
  resetExportState()
  clearWorkspaceDraft()
  void nextTick(() => {
    suppressDraftSave.value = false
  })
}

function newPaper () {
  const hasDraft = hasCurrentDraftContent.value
  if (hasDraft && !window.confirm('Start a new paper and clear the current draft?')) return
  suppressDraftSave.value = true
  const nextPaper = createDefaultPaper()
  paper.title = nextPaper.title
  paper.subject = nextPaper.subject
  paper.duration = nextPaper.duration
  paper.totalMarks = nextPaper.totalMarks
  paper.questions.splice(0, paper.questions.length)
  Object.assign(generationForm, createDefaultGenerationForm())
  generationDiagnostics.value = null
  examDraftName.value = ''
  selectedExamDraftId.value = ''
  clearActiveExamDraft()
  resetExportState()
  clearWorkspaceDraft()
  void nextTick(() => {
    suppressDraftSave.value = false
  })
}

watch([exportMode, layoutDensity, includeAnswersInExport], () => {
  downloadedLayoutDensity.value = null
})

watch(() => currentPaperSignature(), () => {
  downloadedLayoutDensity.value = null
})

watch(
  [() => currentPaperSignature(), () => JSON.stringify(paper.questions), () => JSON.stringify(generationForm), exportMode, layoutDensity, includeAnswersInExport, savedPaperId, savedPaperSignature, generationDiagnostics],
  scheduleWorkspaceDraftSave
)

function defaultExamDraftName () {
  return paper.title.trim() || `Exam draft ${examDrafts.value.length + 1}`
}

function saveCurrentExamDraft () {
  const summary = saveExamDraft(examDraftName.value || defaultExamDraftName())
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
  exported.value = false
  downloadedLayoutDensity.value = null
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

async function generatePaper () {
  generationError.value = ''
  generationDiagnostics.value = null
  if (!canWritePapers.value) {
    generationError.value = 'You do not have permission to generate papers.'
    return
  }
  const payload = buildPaperGeneratePayload(paper, generationForm, bankMode.value)
  if (!payload) {
    generationError.value = 'Please enter a paper title and select at least one subject.'
    return
  }
  isGenerating.value = true

  try {
    const response = await apiFetch<GeneratedPaperResponse>('/papers/generate', {
      method: 'POST',
      body: payload
    })

    applyGenerationResult(response)
    generationDiagnostics.value = response.data.diagnostics
  } catch (error) {
    generationError.value = apiErrorMessage(error, 'Failed to generate paper.')
  } finally {
    isGenerating.value = false
  }
}

function openEditModal (question: Question) {
  editingQuestion.value = question
}

function closeEditModal () {
  editingQuestion.value = null
}

function onQuestionEdited () {
  void loadCurrentPage(1)
}

function openCorrectionModal (question: Question) {
  reportingQuestion.value = question
}

function closeCorrectionModal () {
  reportingQuestion.value = null
}

function openDetailModal (question: Question) {
  detailQuestion.value = question
}

function onQuestionsImported () {
  void loadMeta()
  void loadCurrentPage(1)
}
</script>

<style scoped>
.workspace-section {
  min-width: 0;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(380px, .95fr);
  gap: 24px;
  align-items: start;
}

:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

@media (max-width: 1080px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}

@media print {
  .editor-layout {
    display: block;
  }

  :deep(.workspace-heading),
  :deep(.workspace-tabs),
  :deep(.editor-toolbar),
  :deep(.paper-panel) {
    display: none !important;
  }
}
</style>
