<template>
  <section>
    <h1 class="page-title"><AppIcon name="book" /> Question Bank Workspace</h1>
    <p class="page-sub">Search the bank, inspect answers, and assemble a paper in one page. Questions now load from the backend API.</p>

    <div v-if="!canReadQuestions" class="card permission-card">
      <h2>Login required</h2>
      <p>You need question bank access before opening the workspace.</p>
      <NuxtLink to="/login" class="btn btn-primary">Login</NuxtLink>
    </div>

    <div v-else class="workspace-layout">
      <QuestionBankPanel
        v-model:search="search"
        v-model:filter-subject="filterSubject"
        v-model:filter-difficulty="filterDifficulty"
        :bank-mode="bankMode"
        :available-subjects="availableSubjects"
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
        @edit="openEditModal"
        @report="openCorrectionModal"
        @delete="onDeleteQuestionFromCard"
        @page-change="goToPage"
        @toggle-answer="onToggleAnswer"
      />

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
        :downloaded-layout-density="downloadedLayoutDensity"
        :can-download-docx="canDownloadDocx"
        @update:paper-title="paper.title = $event"
        @update:paper-subject="paper.subject = $event"
        @update:paper-duration="paper.duration = $event"
        @update:generation-form="Object.assign(generationForm, $event)"
        @update:total-marks="paper.totalMarks = $event"
        @generate="generatePaper"
        @move-up="moveUp"
        @move-down="moveDown"
        @remove-question="removeQuestion"
        @export-paper="exportPaper"
        @download-docx="downloadDocx"
        @clear-paper="clearPaper"
      />
    </div>
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
      @close="closeCorrectionModal" />
  </section>
</template>

<script setup lang="ts">
import type { Question, QuestionDifficulty } from '~/types/question'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { BankMode, GeneratedPaperResponse } from '~/domain/papers'
import {
  buildPaperGeneratePayload,
  clonePaperQuestion,
  createDefaultGenerationForm,
  createDefaultPaper,
  parseBankMode,
  parseQuestionDifficulty
} from '~/domain/papers'
import { apiErrorMessage } from '~/utils/apiError'

const EditQuestionModal = defineAsyncComponent(() => import('~/components/questions/EditQuestionModal.vue'))
const QuestionCorrectionModal = defineAsyncComponent(() => import('~/components/questions/QuestionCorrectionModal.vue'))

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
const { hasPermission, isAuthReady, user } = useAuth()
const { apiFetch, apiFetchRaw } = useApi()
const route = useRoute()
const router = useRouter()

function parseQuerySubject (): string {
  const raw = route.query.subjects
  return typeof raw === 'string' ? raw : ''
}

const search = ref((route.query.q as string) || '')
const filterSubject = ref(parseQuerySubject())
const filterDifficulty = ref<QuestionDifficulty | ''>(parseQuestionDifficulty(route.query.difficulty))
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
let searchLoadTimer: ReturnType<typeof setTimeout> | null = null

const paper = reactive(createDefaultPaper())
const generationForm = reactive(createDefaultGenerationForm())

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)

const canReadQuestions = computed(() => hasPermission('questions:read'))
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

const savedPaperId = ref<string | null>(null)
const savedPaperSignature = ref('')

const {
  suppressDraftSave,
  currentPaperSignature,
  restoreWorkspaceDraft,
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

const {
  exported,
  isDownloadingDocx,
  downloadError,
  downloadedLayoutDensity,
  canWritePapers,
  canDownloadDocx,
  exportPaper,
  downloadDocx,
  resetExportState,
  applyGenerationResult
} = usePaperExport({
  paper,
  exportMode,
  layoutDensity,
  includeAnswersInExport,
  canReadAnswers,
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
    if (import.meta.client && ready && allowed) {
      restoreWorkspaceDraft()
      void loadCurrentPage(1)
      void loadMeta()
    }
  },
  { immediate: true }
)

watch([search, filterSubject, filterDifficulty], () => {
  if (import.meta.client) {
    syncQuery()
    if (searchLoadTimer) clearTimeout(searchLoadTimer)
    searchLoadTimer = setTimeout(() => {
      searchLoadTimer = null
      if (isActive.value && canReadQuestions.value) void loadCurrentPage(1)
    }, 250)
  }
})

onBeforeUnmount(() => {
  isActive.value = false
  if (searchLoadTimer) clearTimeout(searchLoadTimer)
  clearDraftSaveTimer()
})

watch(bankMode, () => {
  if (import.meta.client) syncQuery()
})

function syncQuery () {
  if (!isActive.value) return
  const query: Record<string, string> = {}
  const q = search.value.trim()
  if (q) query.q = q
  if (filterSubject.value) query.subjects = filterSubject.value
  if (filterDifficulty.value) query.difficulty = filterDifficulty.value
  if (bankMode.value !== 'all') query.bank = bankMode.value
  void router.replace({ query })
}

watch(canReadAnswers, (allowed) => {
  if (!allowed) includeAnswersInExport.value = false
})

async function switchBankMode (mode: BankMode) {
  bankMode.value = mode
  await loadCurrentPage(1)
}

function currentQuery (page: number) {
  return {
    q: search.value.trim() || undefined,
    subjects: filterSubject.value || undefined,
    difficulty: (filterDifficulty.value || undefined) as Question['difficulty'] | undefined,
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

watch([exportMode, layoutDensity, includeAnswersInExport], () => {
  downloadedLayoutDensity.value = null
})

watch(() => currentPaperSignature(), () => {
  downloadedLayoutDensity.value = null
})

watch(
  [() => currentPaperSignature(), () => JSON.stringify(generationForm), exportMode, layoutDensity, includeAnswersInExport, savedPaperId, savedPaperSignature, generationDiagnostics],
  scheduleWorkspaceDraftSave
)

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
</script>

<style scoped>
.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title svg {
  color: var(--color-primary);
}
.permission-card {
  max-width: 520px;
}
.permission-card h2 {
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.permission-card p {
  color: var(--color-muted);
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }
}

:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

@media (min-width: 1440px) {
  .workspace-layout {
    grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr);
  }
}
</style>
