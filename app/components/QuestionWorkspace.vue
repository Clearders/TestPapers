<template>
  <section class="workspace">
    <div class="workspace-heading">
      <div>
        <h1 class="page-title"><AppIcon name="book" /> Workspace</h1>
        <p class="page-sub">Build an exam in the editor, then switch to the bank to search, filter, inspect, import, and add questions.</p>
      </div>
      <div class="workspace-stats">
        <span class="tag">{{ paper.questions.length }} selected</span>
        <span class="tag">{{ paper.totalMarks }} marks</span>
      </div>
    </div>

    <div
      class="workspace-tabs"
      :class="`workspace-tabs--${activeSection}`"
      role="tablist"
      aria-label="Workspace sections"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="activeSection === 'editor'"
        class="workspace-tab"
        :class="{ 'workspace-tab--active': activeSection === 'editor' }"
        @click="setActiveSection('editor')"
      >
        <AppIcon name="paper" />
        Paper Editor
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeSection === 'bank'"
        class="workspace-tab"
        :class="{ 'workspace-tab--active': activeSection === 'bank' }"
        @click="setActiveSection('bank')"
      >
        <AppIcon name="search" />
        Question Bank
      </button>
    </div>

    <Transition name="fade" mode="out-in">
      <div v-if="activeSection === 'editor'" key="editor" class="workspace-section editor-section">
        <div class="editor-toolbar card">
          <div>
            <h2>Paper Editor</h2>
            <p>Draft metadata, generate a balanced paper, order questions, preview output, and export DOCX.</p>
          </div>
          <div class="editor-actions">
            <button type="button" class="btn btn-outline" @click="newPaper">
              <AppIcon name="add" />
              New Paper
            </button>
            <button type="button" class="btn btn-outline" @click="setActiveSection('bank')">
              <AppIcon name="search" />
              Open Bank
            </button>
          </div>
        </div>

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
        <div v-else class="card workspace-access-card">
          <div class="workspace-access-icon">
            <AppIcon :name="isAuthenticated ? 'users' : 'account'" />
          </div>
          <h2>{{ workspaceAccessTitle }}</h2>
          <p>{{ workspaceAccessMessage }}</p>
          <div v-if="!isAuthenticated" class="workspace-access-actions">
            <NuxtLink to="/register" class="btn btn-primary">
              <AppIcon name="account" />
              Create Account
            </NuxtLink>
            <NuxtLink to="/login" class="btn btn-outline">
              <AppIcon name="login" />
              Login
            </NuxtLink>
          </div>
        </div>
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
  </section>
</template>

<script setup lang="ts">
import type { Question, QuestionDifficulty, QuestionType } from '~/types/question'
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
import { QUESTION_TYPE_ORDER } from '~/domain/questions'
import { apiErrorMessage } from '~/utils/apiError'

type WorkspaceSection = 'editor' | 'bank'

const EditQuestionModal = defineAsyncComponent(() => import('~/components/questions/EditQuestionModal.vue'))
const QuestionCorrectionModal = defineAsyncComponent(() => import('~/components/questions/QuestionCorrectionModal.vue'))
const QuestionDetailModal = defineAsyncComponent(() => import('~/components/questions/QuestionDetailModal.vue'))
const QuestionImportModal = defineAsyncComponent(() => import('~/components/questions/QuestionImportModal.vue'))

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
let searchLoadTimer: ReturnType<typeof setTimeout> | null = null

const paper = reactive(createDefaultPaper())
const generationForm = reactive(createDefaultGenerationForm())

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)
const detailQuestion = ref<Question | null>(null)

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
  const hasDraft = paper.questions.length || paper.title.trim() || paper.subject.trim()
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

function openDetailModal (question: Question) {
  detailQuestion.value = question
}

function onQuestionsImported () {
  void loadMeta()
  void loadCurrentPage(1)
}
</script>

<style scoped>
.workspace-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title svg {
  color: var(--color-primary);
}

.workspace-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
}

.workspace-tabs {
  position: relative;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(128px, 1fr));
  gap: 6px;
  padding: 5px;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-solid) 72%, transparent);
  box-shadow: var(--shadow-soft);
  isolation: isolate;
}

.workspace-tabs::before {
  content: "";
  position: absolute;
  z-index: 0;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 16px) / 2);
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 10px 24px rgba(118, 87, 255, .22);
  transform: translateX(0);
  transition: transform .34s var(--ease-spring), box-shadow .24s ease, opacity .2s ease;
}

.workspace-tabs--bank::before {
  transform: translateX(calc(100% + 6px));
}

.workspace-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 7px 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  font-size: .88rem;
  font-weight: 800;
  transition: color .2s ease, background .2s ease, transform .2s var(--ease-spring), box-shadow .2s ease;
}

.workspace-tab:hover {
  color: var(--color-text);
  transform: translateY(-1px);
}

.workspace-tab--active {
  color: var(--color-on-primary);
  background: transparent;
  box-shadow: none;
}

.workspace-section {
  min-width: 0;
}

.editor-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
}

.editor-toolbar h2 {
  font-size: 1.05rem;
  font-weight: 850;
}

.editor-toolbar p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .86rem;
  line-height: 1.5;
}

.editor-actions,
.workspace-access-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(380px, .95fr);
  gap: 24px;
  align-items: start;
}

.workspace-access-card {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 14px;
}

.workspace-access-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  color: var(--color-on-primary);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: var(--shadow-soft);
}

.workspace-access-card h2 {
  font-size: 1.08rem;
}

.workspace-access-card p {
  color: var(--color-muted);
  line-height: 1.6;
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

@media (max-width: 620px) {
  .workspace-tabs,
  .workspace-tab,
  .editor-actions,
  .editor-actions .btn {
    width: 100%;
  }

  .workspace-tabs {
    border-radius: var(--radius);
    grid-template-columns: 1fr;
  }

  .workspace-tabs::before {
    right: 5px;
    bottom: auto;
    width: auto;
    height: calc((100% - 16px) / 2);
    border-radius: var(--radius);
  }

  .workspace-tabs--bank::before {
    transform: translateY(calc(100% + 6px));
  }

  .editor-toolbar {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-tabs::before {
    transition: none;
  }
}

@media print {
  .workspace-heading,
  .workspace-tabs,
  .editor-toolbar,
  :deep(.paper-panel) {
    display: none !important;
  }

  .editor-layout {
    display: block;
  }
}
</style>
