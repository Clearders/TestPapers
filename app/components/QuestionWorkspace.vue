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
      <div class="bank-panel">
        <div class="panel-head">
          <div>
            <h2><AppIcon name="search" /> Question Bank</h2>
            <p class="panel-sub">Loaded from the backend question service.</p>
          </div>
          <span class="tag count-tag">{{ currentQuestions.length }} / {{ activePagination.total }}</span>
        </div>

        <QuestionBankToolbar
          v-model:search="search"
          v-model:filter-subject="filterSubject"
          v-model:filter-difficulty="filterDifficulty"
          :bank-mode="bankMode"
          :subjects="subjects"
          :can-create-questions="canCreateQuestions"
          @switch-bank-mode="switchBankMode"
        />

        <QuestionCardList
          :questions="currentQuestions"
          :paper-question-ids="paperQuestionIds"
          :loading="activeLoading"
          :question-error="questionError"
          :shown-ids="shownIds"
          :pagination="activePagination"
          :can-read-answers="canReadAnswers"
          :can-review="canReview"
          :can-delete-question="canDeleteQuestion"
          :can-edit-question="canEditQuestion"
          :can-create-questions="canCreateQuestions"
          @toggle-question="toggleQuestion"
          @edit="openEditModal"
          @report="openCorrectionModal"
          @delete="onDeleteQuestionFromCard"
          @page-change="goToPage"
          @toggle-answer="onToggleAnswer"
        />
      </div>

      <div class="paper-panel">
        <div class="panel-head">
          <div>
            <h2><AppIcon name="paper" /> Paper Builder</h2>
            <p class="panel-sub">Build directly from the filtered bank.</p>
          </div>
          <span class="badge tag-count">
            {{ paper.questions.length }} question{{ paper.questions.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div class="card paper-meta-card">
          <div class="form-group">
            <label class="form-label" for="paper-title">Paper Title</label>
            <input id="paper-title" v-model="paper.title" class="form-input" name="paperTitle" placeholder="e.g. Mid-term Examination 2026…" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group paper-meta-field">
              <label class="form-label" for="paper-subject">Subject</label>
              <input id="paper-subject" v-model="paper.subject" class="form-input" name="paperSubject" placeholder="e.g. Mathematics…" />
            </div>
            <div class="form-group paper-meta-field">
              <label class="form-label" for="paper-duration">Duration (min)</label>
              <input id="paper-duration" v-model.number="paper.duration" type="number" min="1" class="form-input" name="paperDuration" placeholder="60…" />
            </div>
          </div>
          <label v-if="canReadAnswers" class="export-toggle">
            <input v-model="includeAnswersInExport" type="checkbox" />
            <span>Include answers in exported paper</span>
          </label>
        </div>

        <PaperGenerationForm
          :generation-form="generationForm"
          :can-write-papers="canWritePapers"
          :is-generating="isGenerating"
          :generation-error="generationError"
          :generation-diagnostics="generationDiagnostics"
          :available-subjects="availableSubjects"
          :available-tags="availableTags"
          :is-loading-meta="isLoadingMeta"
          :total-marks="paper.totalMarks"
          :paper-title="paper.title"
          @update:generation-form="Object.assign(generationForm, $event)"
          @update:total-marks="paper.totalMarks = $event"
          @generate="generatePaper"
        />

        <Transition name="fade" mode="out-in">
          <TransitionGroup name="list" tag="div" class="paper-question-list" v-if="paper.questions.length">
            <div v-for="(q, idx) in paper.questions" :key="q.id" class="paper-q-item card">
              <div class="paper-q-controls">
                <button class="icon-btn" :disabled="idx === 0" @click="moveUp(idx)" aria-label="Move question up"><AppIcon name="arrow-up" /></button>
                <button class="icon-btn" :disabled="idx === paper.questions.length - 1" @click="moveDown(idx)" aria-label="Move question down"><AppIcon name="arrow-down" /></button>
              </div>
              <div class="paper-q-body">
                <div class="paper-q-num">Q{{ idx + 1 }}</div>
                <div class="paper-q-content">
                  <div class="q-meta">
                    <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
                    <span v-for="sub in q.subjects" :key="sub" class="subject-pill">{{ sub }}</span>
                    <span class="tag">weight {{ formatScoreWeight(q.scoreWeight) }}</span>
                    <span v-if="q.marks" class="tag">{{ q.marks }} mark{{ q.marks !== 1 ? 's' : '' }}</span>
                    <span v-for="tag in q.tags" :key="tag" class="tag">{{ tag }}</span>
                  </div>
                  <div class="q-text-wrap">
                    <template v-for="(part, i) in parseLatexParts(q.text)" :key="i">
                      <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                      <span v-else>{{ part.content }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <button class="btn btn-danger btn-sm remove-btn" @click="removeQuestion(q.id)">
                <AppIcon name="trash" />
                Remove
              </button>
            </div>
          </TransitionGroup>
          <div v-else class="empty-paper card">
            <p>No questions added yet. Add them from the bank on the left.</p>
          </div>
        </Transition>

        <div class="paper-actions paper-actions--export">
          <button class="btn btn-success" :disabled="!paper.questions.length || !paper.title.trim()" @click="exportPaper">
            <AppIcon name="paper" />
            Export Paper
          </button>
          <button class="btn btn-primary" :disabled="!canDownloadDocx" @click="downloadDocx">
            <AppIcon name="download" />
            {{ isDownloadingDocx ? 'Preparing DOCX…' : 'Download DOCX' }}
          </button>
          <button class="btn btn-outline" :disabled="!paper.questions.length" @click="clearPaper">
            <AppIcon name="x" />
            Clear All
          </button>
        </div>

        <div v-if="downloadError" class="status-banner status-banner--error download-error" aria-live="polite">
          {{ downloadError }}
        </div>

        <PaperExportPanel
          :visible="exported"
          :paper-title="paper.title"
          :paper-subject="paper.subject"
          :paper-duration="paper.duration"
          :paper-total-marks="paper.totalMarks"
          :paper-questions="paper.questions"
          v-model:export-mode="exportMode"
          v-model:layout-density="layoutDensity"
          v-model:include-answers-in-export="includeAnswersInExport"
          :can-read-answers="canReadAnswers"
          :downloaded-layout-density="downloadedLayoutDensity"
        />
      </div>
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
import QuestionBankToolbar from '~/components/questions/QuestionBankToolbar.vue'
import EditQuestionModal from '~/components/questions/EditQuestionModal.vue'
import QuestionCorrectionModal from '~/components/questions/QuestionCorrectionModal.vue'
import PaperGenerationForm from '~/components/PaperGenerationForm.vue'
import PaperExportPanel from '~/components/PaperExportPanel.vue'
import QuestionCardList from '~/components/QuestionCardList.vue'
import type { Question, QuestionDifficulty, QuestionEntity, QuestionType } from '~/types/question'
import type { GenerationDiagnostics, GenerationFormState, ExportMode, LayoutDensity } from '~/types/generation'
import { normalizeQuestion, boundedNumber, optionalPositiveInteger } from '~/domain/questions'
import { formatScoreWeight } from '~/utils/format'

type PaperQuestion = Question & { marks?: number; orderNo?: number }
type ApiPaperQuestion = Partial<QuestionEntity> & { id: number; marks?: number | null; orderNo?: number | null }

interface PaperMetadataPayload {
  title: string
  subject: string
  duration: number
  totalMarks: number
}

interface PaperQuestionRefPayload {
  questionPublicId: string
  orderNo: number
  marks?: number
}

interface PaperCreatePayload extends PaperMetadataPayload {
  questions: PaperQuestionRefPayload[]
}

interface PaperGeneratePayload {
  title: string
  duration: number
  totalMarks: number
  difficultyCoefficient: number
  questionTypes: Array<{ questionType: QuestionType; count: number }>
  ownQuestionsOnly: boolean
  subjects: string[]
  requiredTags?: string[]
  preferredTags?: string[]
}

interface GeneratedPaperResponse {
  paper: {
    id: number
    publicId: string
    title: string
    subject: string
    duration: number
    totalMarks: number
    questions: ApiPaperQuestion[]
  }
  diagnostics: GenerationDiagnostics
}

interface PaperEntityResponse {
  id: number
  publicId: string
  title: string
  subject: string
  duration: number
  totalMarks: number
}

interface WorkspaceDraft {
  version: 1
  paper: {
    title: string
    subject: string
    duration: number
    totalMarks: number
    questions: PaperQuestion[]
  }
  generationForm: GenerationFormState
  exportMode: ExportMode
  layoutDensity: LayoutDensity
  includeAnswersInExport: boolean
  savedPaperId: string | null
  savedPaperSignature: string
  generationDiagnostics: GenerationDiagnostics | null
}

const {
  canCreateQuestions,
  canReadAnswers,
  questions,
  myQuestions,
  loadQuestions,
  loadMyQuestions,
  deleteQuestion,
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
const { apiFetch } = useApi()
const route = useRoute()
const router = useRouter()
type BankMode = 'all' | 'mine'

const DEFAULT_PAPER = {
  duration: 60,
  totalMarks: 100
}
const WORKSPACE_DRAFT_PREFIX = 'testpapers.workspaceDraft.v1'
const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'true_false', 'blank', 'short_answer', 'essay']
const QUESTION_DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard']

function parseQuerySubject(): string {
  const raw = route.query.subjects
  return typeof raw === 'string' ? raw : ''
}

function parseQueryBank(): BankMode {
  const raw = route.query.bank
  return raw === 'mine' ? 'mine' : 'all'
}

const search = ref((route.query.q as string) || '')
const filterSubject = ref(parseQuerySubject())
const filterDifficulty = ref<QuestionDifficulty | ''>((route.query.difficulty as QuestionDifficulty) || '')
const shownIds = reactive(new Set<number>())
const exportMode = ref<ExportMode>('paper')
const layoutDensity = ref<LayoutDensity>('auto')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>(parseQueryBank())
const pageSize = ref(20)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)
const savedPaperId = ref<string | null>(null)
const savedPaperSignature = ref('')
const isDownloadingDocx = ref(false)
const downloadError = ref('')
const downloadedLayoutDensity = ref<LayoutDensity | null>(null)
const isActive = ref(true)
let searchLoadTimer: ReturnType<typeof setTimeout> | null = null
let draftHydrated = false
let suppressDraftSave = false
let activeDraftKey = ''

const paper = reactive({
  title: '',
  subject: '',
  duration: DEFAULT_PAPER.duration,
  totalMarks: DEFAULT_PAPER.totalMarks,
  questions: [] as PaperQuestion[]
})

const exported = ref(false)

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)

const canReadQuestions = computed(() => hasPermission('questions:read'))
const canWritePapers = computed(() => hasPermission('papers:write'))
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

const generationForm = reactive<GenerationFormState>({
  difficultyCoefficient: 0.5,
  questionTypes: ['single_choice'],
  typeCounts: { single_choice: 5 },
  subjects: [],
  requiredTagsStr: '',
  requiredTags: [],
  preferredTagsStr: '',
  preferredTags: [],
  customTagInput: ''
})

const currentQuestions = computed(() => bankMode.value === 'mine' ? myQuestions.value : questions.value)
const activePagination = computed(() => bankMode.value === 'mine' ? myQuestionPagination.value : questionPagination.value)
const activeLoading = computed(() => bankMode.value === 'mine' ? isLoadingMine.value : isLoading.value)
const canDownloadDocx = computed(() => {
  if (!paper.questions.length || !paper.title.trim() || !paper.subject.trim() || isDownloadingDocx.value) return false
  if (!hasPermission('papers:read')) return false
  return hasPermission('papers:write') || (savedPaperId.value !== null && savedPaperSignature.value === getPaperSignature())
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
})

watch([bankMode], () => {
  if (import.meta.client) syncQuery()
})

function syncQuery() {
  if (!isActive.value) return
  const query: Record<string, string> = {}
  const q = search.value.trim()
  if (q) query.q = q
  if (filterSubject.value) query.subjects = filterSubject.value
  if (filterDifficulty.value) query.difficulty = filterDifficulty.value
  if (bankMode.value !== 'all') query.bank = bankMode.value
  router.replace({ query })
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

const subjects = computed(() => availableSubjects.value)

const paperQuestionIds = computed(() => {
  const ids = new Set<number>()
  for (const q of paper.questions) ids.add(q.id)
  return ids
})
function isAdded (id: number) {
  return paperQuestionIds.value.has(id)
}

function toggleQuestion (question: Question) {
  if (isAdded(question.id)) {
    removeQuestion(question.id)
    return
  }
  paper.questions.push(JSON.parse(JSON.stringify(question)))
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
  suppressDraftSave = true
  paper.questions.length = 0
  exported.value = false
  exportMode.value = 'paper'
  layoutDensity.value = 'auto'
  downloadedLayoutDensity.value = null
  forgetSavedPaper()
  downloadError.value = ''
  clearWorkspaceDraft()
  void nextTick(() => {
    suppressDraftSave = false
  })
}

function exportPaper () {
  exported.value = true
}

function toPositiveInteger (value: unknown, fallback: number, min = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.round(parsed))
}

function paperMetadataPayload (): PaperMetadataPayload {
  return {
    title: paper.title.trim(),
    subject: paper.subject.trim(),
    duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
    totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks)
  }
}

function getPaperPayload (): PaperCreatePayload {
  return {
    ...paperMetadataPayload(),
    questions: paper.questions.map((question, index) => {
      const marks = optionalPositiveInteger(question.marks)
      return {
        questionPublicId: question.publicId,
        orderNo: index + 1,
        ...(marks ? { marks } : {})
      }
    })
  }
}

function getPaperSignature () {
  return JSON.stringify(getPaperPayload())
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuestionType (value: unknown): value is QuestionType {
  return typeof value === 'string' && QUESTION_TYPES.includes(value as QuestionType)
}

function isQuestionDifficulty (value: unknown): value is QuestionDifficulty {
  return typeof value === 'string' && QUESTION_DIFFICULTIES.includes(value as QuestionDifficulty)
}

function stringArrayFromDraft (value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function optionalStringArrayFromDraft (value: unknown) {
  const items = stringArrayFromDraft(value)
  return Array.isArray(value) ? items : undefined
}

function numberFromDraft (value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function validateDraftQuestion (value: unknown): PaperQuestion | null {
  if (!isRecord(value)) return null
  if (!Number.isFinite(value.id) || typeof value.publicId !== 'string' || !value.publicId.trim()) return null
  if (!isQuestionType(value.type) || !isQuestionDifficulty(value.difficulty)) return null
  if (typeof value.text !== 'string') return null

  return {
    id: Number(value.id),
    publicId: value.publicId,
    type: value.type,
    subjects: stringArrayFromDraft(value.subjects),
    difficulty: value.difficulty,
    tags: stringArrayFromDraft(value.tags),
    text: value.text,
    ...(optionalStringArrayFromDraft(value.options) ? { options: optionalStringArrayFromDraft(value.options) } : {}),
    answer: Array.isArray(value.answer) ? stringArrayFromDraft(value.answer) : String(value.answer ?? ''),
    hasLatex: Boolean(value.hasLatex),
    ...(typeof value.source === 'string' ? { source: value.source } : {}),
    ...(isRecord(value.essayBlankSpace) ? {
      essayBlankSpace: {
        lines: toPositiveInteger(value.essayBlankSpace.lines, 6),
        lineHeight: toPositiveInteger(value.essayBlankSpace.lineHeight, 28)
      }
    } : {}),
    ...(Array.isArray(value.images) ? { images: value.images.filter(isRecord).map(image => ({
      url: typeof image.url === 'string' ? image.url : '',
      ...(typeof image.caption === 'string' ? { caption: image.caption } : {})
    })).filter(image => image.url) } : {}),
    scoreWeight: numberFromDraft(value.scoreWeight, 1),
    ...(optionalPositiveInteger(value.marks) ? { marks: optionalPositiveInteger(value.marks) } : {}),
    ...(optionalPositiveInteger(value.orderNo) ? { orderNo: optionalPositiveInteger(value.orderNo) } : {}),
    ...(typeof value.ownerId === 'number' || value.ownerId === null ? { ownerId: value.ownerId } : {})
  }
}

function validateGenerationFormDraft (value: unknown): GenerationFormState {
  if (!isRecord(value)) return { ...generationForm, questionTypes: [...generationForm.questionTypes], typeCounts: { ...generationForm.typeCounts } }

  const questionTypes = stringArrayFromDraft(value.questionTypes).filter(isQuestionType)
  const typeCounts: Record<string, number> = {}
  if (isRecord(value.typeCounts)) {
    for (const type of QUESTION_TYPES) {
      const count = optionalPositiveInteger(value.typeCounts[type])
      if (count) typeCounts[type] = count
    }
  }

  return {
    difficultyCoefficient: boundedNumber(value.difficultyCoefficient, 0.5, 0, 1),
    questionTypes: questionTypes.length ? questionTypes : ['single_choice'],
    typeCounts: Object.keys(typeCounts).length ? typeCounts : { single_choice: 5 },
    subjects: stringArrayFromDraft(value.subjects),
    requiredTagsStr: typeof value.requiredTagsStr === 'string' ? value.requiredTagsStr : '',
    requiredTags: stringArrayFromDraft(value.requiredTags),
    preferredTagsStr: typeof value.preferredTagsStr === 'string' ? value.preferredTagsStr : '',
    preferredTags: stringArrayFromDraft(value.preferredTags),
    customTagInput: typeof value.customTagInput === 'string' ? value.customTagInput : ''
  }
}

function validateWorkspaceDraft (value: unknown): WorkspaceDraft | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.paper)) return null
  const questions = Array.isArray(value.paper.questions)
    ? value.paper.questions.map(validateDraftQuestion).filter((question): question is PaperQuestion => question !== null)
    : []
  const draftExportMode = value.exportMode === 'categorized' ? 'categorized' : 'paper'
  const draftLayoutDensity = layoutDensityFromHeader(typeof value.layoutDensity === 'string' ? value.layoutDensity : null) || 'auto'

  return {
    version: 1,
    paper: {
      title: typeof value.paper.title === 'string' ? value.paper.title : '',
      subject: typeof value.paper.subject === 'string' ? value.paper.subject : '',
      duration: toPositiveInteger(value.paper.duration, DEFAULT_PAPER.duration),
      totalMarks: toPositiveInteger(value.paper.totalMarks, DEFAULT_PAPER.totalMarks),
      questions
    },
    generationForm: validateGenerationFormDraft(value.generationForm),
    exportMode: draftExportMode,
    layoutDensity: draftLayoutDensity,
    includeAnswersInExport: Boolean(value.includeAnswersInExport),
    savedPaperId: typeof value.savedPaperId === 'string' && value.savedPaperId.trim() ? value.savedPaperId : null,
    savedPaperSignature: typeof value.savedPaperSignature === 'string' ? value.savedPaperSignature : '',
    generationDiagnostics: isRecord(value.generationDiagnostics) ? value.generationDiagnostics as unknown as GenerationDiagnostics : null
  }
}

function getWorkspaceDraftKey () {
  return user.value ? `${WORKSPACE_DRAFT_PREFIX}.${user.value.id}` : ''
}

function buildWorkspaceDraft (): WorkspaceDraft {
  return {
    version: 1,
    paper: {
      title: paper.title,
      subject: paper.subject,
      duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
      totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks),
      questions: JSON.parse(JSON.stringify(paper.questions)) as PaperQuestion[]
    },
    generationForm: JSON.parse(JSON.stringify(generationForm)) as GenerationFormState,
    exportMode: exportMode.value,
    layoutDensity: layoutDensity.value,
    includeAnswersInExport: includeAnswersInExport.value && canReadAnswers.value,
    savedPaperId: savedPaperId.value,
    savedPaperSignature: savedPaperSignature.value,
    generationDiagnostics: generationDiagnostics.value ? JSON.parse(JSON.stringify(generationDiagnostics.value)) as GenerationDiagnostics : null
  }
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
  downloadedLayoutDensity.value = null
  downloadError.value = ''

  const signatureMatches = Boolean(draft.savedPaperId && draft.savedPaperSignature && draft.savedPaperSignature === getPaperSignature())
  savedPaperId.value = signatureMatches ? draft.savedPaperId : null
  savedPaperSignature.value = signatureMatches ? draft.savedPaperSignature : ''
}

function restoreWorkspaceDraft () {
  const key = getWorkspaceDraftKey()
  if (!key) return
  if (draftHydrated && activeDraftKey === key) return

  activeDraftKey = key
  draftHydrated = false
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
    draftHydrated = true
  }
}

function saveWorkspaceDraft (serializedDraft: string) {
  const key = getWorkspaceDraftKey()
  if (!key) return
  activeDraftKey = key
  try {
    localStorage.setItem(key, serializedDraft)
  } catch {
    // Storage can be unavailable or full; the Workspace should remain usable.
  }
}

function clearWorkspaceDraft () {
  const key = activeDraftKey || getWorkspaceDraftKey()
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage failures during local draft cleanup.
  }
}
watch([exportMode, layoutDensity, includeAnswersInExport], () => {
  downloadedLayoutDensity.value = null
})

watch(() => getPaperSignature(), () => {
  downloadedLayoutDensity.value = null
})

watch(
  () => JSON.stringify(buildWorkspaceDraft()),
  (serializedDraft) => {
    if (!import.meta.client || !draftHydrated || suppressDraftSave) return
    saveWorkspaceDraft(serializedDraft)
  }
)

async function ensureDownloadablePaper () {
  const signature = getPaperSignature()
  if (savedPaperId.value !== null && savedPaperSignature.value === signature) {
    return savedPaperId.value
  }

  const response = await apiFetch<PaperEntityResponse>('/papers', {
    method: 'POST',
    body: getPaperPayload()
  })
  savedPaperId.value = response.data.publicId
  savedPaperSignature.value = signature
  return response.data.publicId
}

async function requestDocxDownload (paperPublicId: string) {
  const params = new URLSearchParams({
    format: 'docx',
    questionOrder: exportMode.value,
    includeAnswer: String(includeAnswersInExport.value && canReadAnswers.value),
    layoutDensity: layoutDensity.value
  })
  const response = await apiFetch<Response>(`/papers/${paperPublicId}/download`, {
    method: 'GET',
    query: Object.fromEntries(params),
    responseType: 'blob',
    rawResponse: true
  })
  return response as unknown as Response
}

function filenameFromDisposition (disposition: string | null) {
  if (!disposition) return `${paper.title.trim() || 'examination-paper'}.docx`

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return encodedMatch[1]
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i)
  return quotedMatch?.[1] || `${paper.title.trim() || 'examination-paper'}.docx`
}

function layoutDensityFromHeader (value: string | null): LayoutDensity | null {
  if (value === 'normal' || value === 'compact' || value === 'dense' || value === 'auto') return value
  return null
}

async function downloadDocx () {
  if (isDownloadingDocx.value) return

  downloadError.value = ''
  isDownloadingDocx.value = true
  try {
    const paperId = await ensureDownloadablePaper()
    const response = await requestDocxDownload(paperId)
    if (!response.ok) {
      throw new Error(await response.text() || 'Failed to download DOCX.')
    }

    const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase()
    if (contentType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const responseText = await response.text()
      let message = 'The download endpoint did not return a DOCX file.'
      try {
        const payload = JSON.parse(responseText)
        message = payload?.error?.message || payload?.detail?.message || message
      } catch {
        if (responseText.trim()) message = responseText
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    downloadedLayoutDensity.value = layoutDensityFromHeader(response.headers.get('X-Layout-Density'))
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filenameFromDisposition(response.headers.get('Content-Disposition'))
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  } catch (error) {
    downloadError.value = error instanceof Error ? error.message : 'Failed to download DOCX.'
  } finally {
    isDownloadingDocx.value = false
  }
}

function buildPaperGeneratePayload (): PaperGeneratePayload | null {
  if (!paper.title.trim() || !generationForm.subjects.length) {
    generationError.value = 'Please enter a paper title and select at least one subject.'
    return null
  }

  return {
    title: paper.title.trim(),
    subjects: [...generationForm.subjects],
    duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
    totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks),
    difficultyCoefficient: boundedNumber(generationForm.difficultyCoefficient, 0.5, 0, 1),
    questionTypes: generationForm.questionTypes.map(type => ({
      questionType: type,
      count: generationForm.typeCounts[type] || 1
    })),
    ownQuestionsOnly: bankMode.value === 'mine',
    ...(generationForm.requiredTags.length ? { requiredTags: generationForm.requiredTags } : {}),
    ...(generationForm.preferredTags.length ? { preferredTags: generationForm.preferredTags } : {})
  }
}

function normalizePaperQuestion (question: ApiPaperQuestion): PaperQuestion {
  const normalized = normalizeQuestion(question)
  return {
    ...normalized,
    marks: optionalPositiveInteger(question.marks),
    orderNo: optionalPositiveInteger(question.orderNo)
  }
}

function setPaperQuestions (questions: ApiPaperQuestion[]) {
  paper.questions.splice(0, paper.questions.length, ...questions.map(normalizePaperQuestion))
}

function rememberSavedPaper (paperId: string) {
  savedPaperId.value = paperId
  savedPaperSignature.value = getPaperSignature()
}

function forgetSavedPaper () {
  savedPaperId.value = null
  savedPaperSignature.value = ''
}

function apiErrorMessage (error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) return fallback

  const candidate = error as {
    message?: string
    data?: {
      detail?: unknown
      error?: {
        message?: unknown
        details?: unknown
      }
    }
  }
  const envelopeError = candidate.data?.error
  if (envelopeError && typeof envelopeError.message === 'string' && envelopeError.message.trim()) {
    const details = envelopeError.details
    if (Array.isArray(details) && details.length) {
      const firstDetail = details[0] as { field?: unknown, reason?: unknown } | undefined
      if (firstDetail && typeof firstDetail.reason === 'string' && firstDetail.reason.trim()) {
        const field = typeof firstDetail.field === 'string' && firstDetail.field.trim() ? `${firstDetail.field}: ` : ''
        return `${field}${firstDetail.reason}`
      }
    }
    return envelopeError.message
  }

  const detail = candidate.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (typeof detail === 'object' && detail !== null && 'message' in detail) {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (Array.isArray(detail) && detail.length) {
    const firstMessage = (detail[0] as { msg?: unknown } | undefined)?.msg
    if (typeof firstMessage === 'string' && firstMessage.trim()) return firstMessage
  }
  return candidate.message || fallback
}

async function generatePaper () {
  generationError.value = ''
  generationDiagnostics.value = null
  if (!canWritePapers.value) {
    generationError.value = 'You do not have permission to generate papers.'
    return
  }
  const payload = buildPaperGeneratePayload()
  if (!payload) return
  isGenerating.value = true

  try {
    const response = await apiFetch<GeneratedPaperResponse>('/papers/generate', {
      method: 'POST',
      body: payload
    })

    paper.title = response.data.paper.title
    paper.subject = response.data.paper.subject
    paper.duration = response.data.paper.duration
    paper.totalMarks = response.data.paper.totalMarks
    setPaperQuestions(response.data.paper.questions)
    rememberSavedPaper(response.data.paper.publicId)
    generationDiagnostics.value = response.data.diagnostics
    exported.value = false
    downloadError.value = ''
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
.bank-panel,
.paper-panel {
  min-width: 0;
  animation: revealUp 0.56s var(--ease-out) both;
}
.bank-panel { animation-delay: 0.08s; }
.paper-panel { animation-delay: 0.16s; }
@media (max-width: 900px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  animation: revealUp 0.42s var(--ease-out) both;
}
.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 850;
}
.panel-sub {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 4px;
}

.count-tag,
.tag-count {
  background: #eff3fe;
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
.paper-meta-card {
  margin-bottom: 16px;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.07), rgba(255, 138, 76, 0.04)),
    var(--color-surface);
}
.paper-meta-card::after {
  content: "";
  position: absolute;
  inset: auto -20% -54px 18%;
  height: 118px;
  background: linear-gradient(90deg, rgba(118, 87, 255, .08), rgba(14, 165, 233, .08), transparent);
  transform: rotate(-7deg);
  transition: transform .42s var(--ease-out), opacity .42s ease;
  pointer-events: none;
}
.paper-meta-card:hover::after {
  opacity: .95;
  transform: translateX(8%) rotate(-4deg);
}
.paper-meta-field {
  flex: 1;
}
.paper-question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}
.paper-q-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  transition: transform .34s var(--ease-out), box-shadow .34s var(--ease-out), border-color .34s ease;
}
.paper-q-item::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--color-primary), var(--color-secondary));
  transform-origin: top;
  animation: sideBarGrow 0.42s var(--ease-out) both;
}
.paper-q-item:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow);
  border-color: var(--color-primary);
}
.paper-q-item > * {
  position: relative;
  z-index: 1;
}
.q-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.q-text-wrap {
  font-size: .95rem;
  line-height: 1.7;
  min-width: 0;
  overflow-wrap: anywhere;
}
.paper-actions,
.paper-meta-row,
.export-toggle {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.paper-meta-row > .form-group {
  min-width: 150px;
}
.paper-actions--export {
  margin-top: 20px;
}
.export-toggle {
  align-items: center;
  margin-top: 4px;
  color: var(--color-text);
  font-size: .9rem;
}
.export-toggle input {
  margin: 0;
}
.paper-q-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0;
  font-size: .9rem;
  color: var(--color-muted);
  transition: background .22s ease, color .22s ease, transform .22s var(--ease-spring), border-color .22s ease, box-shadow .22s ease;
}
.icon-btn:hover:not(:disabled) {
  background: var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-primary);
  transform: translateY(-2px) scale(1.04);
  box-shadow: var(--shadow-soft);
}
.icon-btn:active:not(:disabled) {
  transform: scale(.94);
}
.icon-btn:disabled {
  opacity: .3;
  cursor: not-allowed;
}
.paper-q-body {
  flex: 1;
  display: flex;
  gap: 10px;
  min-width: 0;
}
.paper-q-num {
  min-width: 28px;
  font-weight: 700;
  color: var(--color-primary);
}
.paper-q-content {
  flex: 1;
  min-width: 0;
}
.remove-btn {
  white-space: nowrap;
}
.empty-paper {
  text-align: center;
  color: var(--color-muted);
}
.download-error {
  margin-top: 14px;
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

@media (max-width: 700px) {
  .paper-q-item {
    flex-direction: column;
  }

  .paper-q-controls {
    flex-direction: row;
    width: 100%;
  }

  .paper-q-body,
  .remove-btn {
    width: 100%;
  }

  .paper-q-num {
    min-width: 24px;
  }
}

@media (max-width: 560px) {
  .paper-actions .btn {
    width: 100%;
  }

  .paper-meta-row > .form-group {
    min-width: 100%;
  }
}

.subject-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
  transition: transform .18s ease, background .18s ease;
}
.subject-pill:hover {
  transform: translateY(-1px);
  background: rgba(79, 110, 247, 0.16);
}

@keyframes sideBarGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
</style>
