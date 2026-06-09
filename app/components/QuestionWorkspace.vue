<template>
  <section>
    <h1 class="page-title">Question Bank Workspace</h1>
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
            <h2>Question Bank</h2>
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

        <div v-if="questionError" class="status-banner status-banner--error">
          {{ questionError }}
        </div>

        <div v-if="activeLoading" class="status-banner" aria-live="polite">
          Loading questions…
        </div>

        <TransitionGroup name="list" tag="div" class="q-list" v-if="currentQuestions.length">
          <QuestionBankCard
            v-for="(q, index) in currentQuestions"
            :key="q.id"
            :question="q"
            :index="index"
            :can-read-answers="canReadAnswers"
            :is-shown="isShown(q.id)"
            :is-added="isAdded(q.id)"
            :type-label="typeLabel"
            @toggle-answer="toggleAnswer"
            @toggle-question="toggleQuestion"
          />
        </TransitionGroup>

        <PaginationControls
          :pagination="activePagination"
          :loading="activeLoading"
          @change="goToPage"
        />

        <Transition name="fade">
          <div v-if="!activeLoading && !currentQuestions.length" class="empty-state card">
            <p>No questions match the current filters.</p>
            <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">Create a Problem</NuxtLink>
          </div>
        </Transition>
      </div>

      <div class="paper-panel">
        <div class="panel-head">
          <div>
            <h2>Paper Builder</h2>
            <p class="panel-sub">Build directly from the filtered bank.</p>
          </div>
          <span class="badge tag-count">
            {{ paper.questions.length }} question{{ paper.questions.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div class="card paper-meta-card">
          <div class="form-group">
            <label class="form-label">Paper Title</label>
            <input v-model="paper.title" class="form-input" placeholder="e.g. Mid-term Examination 2026" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group paper-meta-field">
              <label class="form-label">Subject</label>
              <input v-model="paper.subject" class="form-input" placeholder="e.g. Mathematics" />
            </div>
            <div class="form-group paper-meta-field">
              <label class="form-label">Duration (min)</label>
              <input v-model.number="paper.duration" type="number" min="1" class="form-input" placeholder="60" />
            </div>
          </div>
          <label v-if="canReadAnswers" class="export-toggle">
            <input v-model="includeAnswersInExport" type="checkbox" />
            <span>Include answers in exported paper</span>
          </label>
        </div>

        <form v-if="canWritePapers" class="card generation-card" @submit.prevent="generatePaper">
          <div class="panel-head generation-card__head">
            <div>
              <h2>Auto Generate</h2>
              <p class="panel-sub">Use a genetic algorithm to compose a balanced paper from the question bank.</p>
            </div>
            <span v-if="generationDiagnostics" class="tag count-tag">fitness {{ generationDiagnostics.fitness }}</span>
          </div>

          <section class="generation-section">
            <div class="generation-section__head">
              <h3>Generation Settings</h3>
              <span class="badge" style="background: linear-gradient(90deg, #4f6ef7, #22c55e); color: white;">Optimization</span>
            </div>
            <div class="generation-grid">
              <div class="setting-card setting-card--score">
                <label class="form-label">Total Score</label>
                <div class="wheel-selector">
                  <button
                    v-for="score in [50, 100, 120, 150]"
                    :key="score"
                    type="button"
                    class="wheel-option"
                    :class="{ 'wheel-option--active': paper.totalMarks === score }"
                    @click="paper.totalMarks = score"
                  >
                    {{ score }}
                  </button>
                  <input
                    v-model.number="paper.totalMarks"
                    class="form-input custom-score"
                    type="number"
                    min="1"
                    placeholder="Custom"
                  />
                </div>
              </div>
              <div class="setting-card setting-card--type">
                <label class="form-label">Question Type</label>
                <div class="wheel-selector">
                  <button
                    v-for="type in QUESTION_TYPE_ORDER"
                    :key="type"
                    type="button"
                    class="wheel-option"
                    :class="{ 'wheel-option--active': generationForm.questionType === type }"
                    @click="generationForm.questionType = type"
                  >
                    {{ QUESTION_TYPE_LABELS[type] }}
                  </button>
                </div>
              </div>
              <div class="setting-card setting-card--diff setting-card--small">
                <label class="form-label">Difficulty: {{ generationForm.difficultyCoefficient }}</label>
                <input
                  v-model.number="generationForm.difficultyCoefficient"
                  class="form-range form-range--primary"
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                />
              </div>
            </div>
          </section>

          <div class="generation-footer">
            <div class="paper-actions">
              <button class="btn btn-primary" type="submit" :disabled="isGenerating || !paper.title.trim() || !paper.subject.trim()">
                {{ isGenerating ? 'Generating…' : 'Generate Paper' }}
              </button>
              <span class="form-hint">Uses the current paper title, subject, and duration.</span>
            </div>
          </div>

          <div v-if="generationError" class="status-banner status-banner--error" aria-live="polite">
            {{ generationError }}
          </div>
          <div v-if="generationDiagnostics" class="generation-summary">
            <span class="summary-pill">Difficulty: {{ formatDistribution(generationDiagnostics.difficultyActual) }}</span>
            <span class="summary-pill">Types: {{ formatDistribution(generationDiagnostics.typeActual) }}</span>
            <span v-if="generationDiagnostics.questionCount" class="summary-pill">Questions: {{ generationDiagnostics.questionCount }}</span>
            <span v-if="generationDiagnostics.marksActual" class="summary-pill">Marks: {{ generationDiagnostics.marksActual }}</span>
            <span v-if="generationDiagnostics.scoreWeightActual" class="summary-pill">Weight: {{ generationDiagnostics.scoreWeightActual }}</span>
            <span class="summary-pill">Candidates: {{ generationDiagnostics.candidateCount }}</span>
          </div>
        </form>
        <div v-else class="card generation-card">
          <div class="panel-head generation-card__head">
            <div>
              <h2>Auto Generate</h2>
              <p class="panel-sub">Paper generation requires papers:write permission.</p>
            </div>
          </div>
        </div>

        <Transition name="fade" mode="out-in">
          <TransitionGroup name="list" tag="div" class="paper-question-list" v-if="paper.questions.length">
            <div v-for="(q, idx) in paper.questions" :key="q.id" class="paper-q-item card">
              <div class="paper-q-controls">
                <button class="icon-btn" :disabled="idx === 0" @click="moveUp(idx)" title="Up">Up</button>
                <button class="icon-btn" :disabled="idx === paper.questions.length - 1" @click="moveDown(idx)" title="Down">Down</button>
              </div>
              <div class="paper-q-body">
                <div class="paper-q-num">Q{{ idx + 1 }}</div>
                <div class="paper-q-content">
                  <div class="q-meta">
                    <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
                    <span class="tag">{{ q.subject }}</span>
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
              <button class="btn btn-danger btn-sm remove-btn" @click="removeQuestion(q.id)">Remove</button>
            </div>
          </TransitionGroup>
          <div v-else class="empty-paper card">
            <p>No questions added yet. Add them from the bank on the left.</p>
          </div>
        </Transition>

        <div class="paper-actions paper-actions--export">
          <button class="btn btn-success" :disabled="!paper.questions.length || !paper.title.trim()" @click="exportPaper">
            Export Paper
          </button>
          <button class="btn btn-primary" :disabled="!canDownloadDocx" @click="downloadDocx">
            {{ isDownloadingDocx ? 'Preparing DOCX…' : 'Download DOCX' }}
          </button>
          <button class="btn btn-outline" :disabled="!paper.questions.length" @click="clearPaper">
            Clear All
          </button>
        </div>

        <div v-if="downloadError" class="status-banner status-banner--error download-error" aria-live="polite">
          {{ downloadError }}
        </div>

        <Transition name="fade">
          <div v-if="exported" class="export-preview card">
            <div class="export-preview-head">
              <div>
                <h3>{{ paper.title }}</h3>
                <p>
                  Subject: {{ paper.subject || '-' }} |
                  Duration: {{ paper.duration }} min |
                  Total: {{ paper.totalMarks }} marks
                </p>
              </div>
              <div class="export-mode-actions" aria-label="Export question order">
                <button
                  class="btn btn-sm"
                  :class="exportMode === 'paper' ? 'btn-primary' : 'btn-outline'"
                  @click="exportMode = 'paper'"
                >
                  Paper Order
                </button>
                <button
                  class="btn btn-sm"
                  :class="exportMode === 'categorized' ? 'btn-primary' : 'btn-outline'"
                  @click="exportMode = 'categorized'"
                >
                  By Type
                </button>
              </div>
            </div>
            <p class="export-preview-note">
              {{ exportMode === 'categorized' ? 'Questions are grouped as multiple-choice, fill-in-the-blank, and essay, with forward numbering across sections.' : 'Questions follow the order from the paper builder.' }}
            </p>
            <section v-for="section in exportSections" :key="section.key" class="export-section">
              <h4 v-if="section.title" class="export-section-title">{{ section.title }}</h4>
              <ol class="export-q-list" :start="section.start">
                <li v-for="q in section.questions" :key="q.id" class="export-question">
                  <span v-if="q.marks" class="export-mark">{{ q.marks }} mark{{ q.marks !== 1 ? 's' : '' }}</span>
                  <div class="export-q-text">
                    <template v-for="(part, i) in parseLatexParts(q.text)" :key="i">
                      <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                      <span v-else>{{ part.content }}</span>
                    </template>
                  </div>

                  <div v-if="isOptionQuestionType(q.type) && q.options?.length" class="export-options">
                    <div v-for="(opt, idx) in q.options" :key="idx" class="export-option">
                      <span class="q-option-label">{{ String.fromCharCode(65 + idx) }}.</span>
                      <span>
                        <template v-for="(part, i) in parseLatexParts(opt)" :key="i">
                          <LatexRenderer v-if="part.isLatex" :formula="part.content" />
                          <span v-else>{{ part.content }}</span>
                        </template>
                      </span>
                    </div>
                  </div>

                  <div
                    v-if="q.type === 'essay'"
                    class="export-essay-space"
                    :style="getEssayBlankStyle(q)"
                  />

                  <div v-if="q.images?.length" class="export-images">
                    <img
                      v-for="(img, imgIdx) in q.images"
                      :key="imgIdx"
                      :src="img.url"
                      :alt="img.caption || 'Question image'"
                      :title="img.caption || ''"
                      width="160"
                      height="120"
                      class="export-image-thumb"
                    />
                  </div>

                  <div v-if="includeAnswersInExport && canReadAnswers" class="export-answer">
                    <strong>Answer:</strong>
                    <template v-for="(part, i) in parseLatexParts(q.answer)" :key="i">
                      <LatexRenderer v-if="part.isLatex" :formula="part.content" />
                      <span v-else>{{ part.content }}</span>
                    </template>
                  </div>
                </li>
              </ol>
            </section>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import PaginationControls from '~/components/questions/PaginationControls.vue'
import QuestionBankCard from '~/components/questions/QuestionBankCard.vue'
import QuestionBankToolbar from '~/components/questions/QuestionBankToolbar.vue'
import type { Question, QuestionEntity } from '~/types/question'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ORDER,
  getEssayBlankHeightPx,
  isOptionQuestionType,
  normalizeQuestion
} from '~/domain/questions'

interface GenerationDiagnostics {
  fitness: number
  candidateCount: number
  questionCount: number
  ownQuestionsOnly: boolean
  difficultyActual: Record<string, number>
  difficultyTargets: Record<string, number>
  typeActual: Record<string, number>
  typeTargets: Record<string, number>
  difficultyCoefficient: number
  scoreWeightActual: number
  marksActual: number
  generationsRun: number
  requiredTags: string[]
  preferredTags: string[]
}

type PaperQuestion = Question & { marks?: number; orderNo?: number }
type ApiPaperQuestion = Partial<QuestionEntity> & { id: number; marks?: number | null; orderNo?: number | null }

interface PaperMetadataPayload {
  title: string
  subject: string
  duration: number
  totalMarks: number
}

interface PaperQuestionRefPayload {
  questionId: number
  orderNo: number
  marks?: number
}

interface PaperCreatePayload extends PaperMetadataPayload {
  questions: PaperQuestionRefPayload[]
}

interface PaperGeneratePayload extends PaperMetadataPayload {
  difficultyCoefficient: number
  questionType: QuestionType
  ownQuestionsOnly: boolean
  requiredTags?: string[]
  preferredTags?: string[]
}

interface GeneratedPaperResponse {
  paper: {
    id: number
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
  title: string
  subject: string
  duration: number
  totalMarks: number
}

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
  myQuestionPagination
} = useQuestionBank()
const { hasPermission, isAuthReady } = useAuth()
const { apiFetch, getApiBase, refreshSessionCookie } = useApi()
type ExportMode = 'paper' | 'categorized'
type QuestionType = Question['type']
type QuestionDifficulty = Question['difficulty']
type BankMode = 'all' | 'mine'
interface GenerationFormState {
  difficultyCoefficient: number
  questionType: QuestionType
}

const DEFAULT_PAPER = {
  duration: 60,
  totalMarks: 100
}

const search = ref('')
const filterSubject = ref('')
const filterDifficulty = ref<QuestionDifficulty | ''>('')
const shownIds = reactive(new Set<number>())
function isShown (id: number) { return shownIds.has(id) }
const exportMode = ref<ExportMode>('paper')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>('all')
const pageSize = ref(20)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)
const savedPaperId = ref<number | null>(null)
const savedPaperSignature = ref('')
const isDownloadingDocx = ref(false)
const downloadError = ref('')

const paper = reactive({
  title: '',
  subject: '',
  duration: DEFAULT_PAPER.duration,
  totalMarks: DEFAULT_PAPER.totalMarks,
  questions: [] as PaperQuestion[]
})

const exported = ref(false)

const canReadQuestions = computed(() => hasPermission('questions:read'))
const canWritePapers = computed(() => hasPermission('papers:write'))

const generationForm = reactive<GenerationFormState>({
  difficultyCoefficient: 0.5,
  questionType: 'choice'
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
    if (ready && allowed) {
      void loadCurrentPage(1)
    }
  },
  { immediate: true }
)

watch([search, filterSubject, filterDifficulty], () => {
  if (canReadQuestions.value) void loadCurrentPage(1)
})

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
    subject: filterSubject.value || undefined,
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

function typeLabel (type: Question['type']) {
  return QUESTION_TYPE_LABELS[type] || type
}

const subjects = computed(() => {
  const seen = new Set<string>()
  for (const q of currentQuestions.value) seen.add(q.subject)
  return [...seen].sort()
})

const exportSections = computed(() => {
  if (exportMode.value !== 'categorized') {
    return [{ key: 'paper', title: '', questions: paper.questions, start: 1 }]
  }

  const byType = new Map<QuestionType, PaperQuestion[]>()
  for (const q of paper.questions) {
    const list = byType.get(q.type)
    if (list) list.push(q)
    else byType.set(q.type, [q])
  }

  const sections: { key: string; title: string; questions: PaperQuestion[]; start: number }[] = []
  let start = 1
  for (const type of QUESTION_TYPE_ORDER) {
    const questions = byType.get(type)
    if (!questions || !questions.length) continue
    sections.push({ key: type, title: QUESTION_TYPE_LABELS[type], questions, start })
    start += questions.length
  }
  return sections
})

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
  paper.questions.push({ ...question })
}

function removeQuestion (id: number) {
  const idx = paper.questions.findIndex(q => q.id === id)
  if (idx !== -1) paper.questions.splice(idx, 1)
}

function moveUp (idx: number) {
  if (idx === 0 || idx >= paper.questions.length) return
  const [question] = paper.questions.splice(idx, 1)
  if (!question) return
  paper.questions.splice(idx - 1, 0, question)
}

function moveDown (idx: number) {
  if (idx >= paper.questions.length - 1) return
  const [question] = paper.questions.splice(idx, 1)
  if (!question) return
  paper.questions.splice(idx + 1, 0, question)
}

function clearPaper () {
  paper.questions.length = 0
  exported.value = false
  exportMode.value = 'paper'
  forgetSavedPaper()
  downloadError.value = ''
}

function exportPaper () {
  exported.value = true
}

function toPositiveInteger (value: unknown, fallback: number, min = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.round(parsed))
}

function toBoundedNumber (value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function toOptionalPositiveInteger (value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.round(parsed)
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
      const marks = toOptionalPositiveInteger(question.marks)
      return {
        questionId: question.id,
        orderNo: index + 1,
        ...(marks ? { marks } : {})
      }
    })
  }
}

function getPaperSignature () {
  return JSON.stringify(getPaperPayload())
}

async function ensureDownloadablePaper () {
  const signature = getPaperSignature()
  if (savedPaperId.value !== null && savedPaperSignature.value === signature) {
    return savedPaperId.value
  }

  const response = await apiFetch<PaperEntityResponse>('/papers', {
    method: 'POST',
    body: getPaperPayload()
  })
  savedPaperId.value = response.data.id
  savedPaperSignature.value = signature
  return response.data.id
}

async function requestDocxDownload (paperId: number) {
  const params = new URLSearchParams({
    format: 'docx',
    questionOrder: exportMode.value,
    includeAnswer: String(includeAnswersInExport.value && canReadAnswers.value)
  })
  const response = await fetch(`${getApiBase()}/papers/${paperId}/download?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  })

  if (response.status !== 401 || !(await refreshSessionCookie())) {
    return response
  }

  return await fetch(`${getApiBase()}/papers/${paperId}/download?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  })
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

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filenameFromDisposition(response.headers.get('Content-Disposition'))
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    downloadError.value = error instanceof Error ? error.message : 'Failed to download DOCX.'
  } finally {
    isDownloadingDocx.value = false
  }
}

function buildPaperGeneratePayload (): PaperGeneratePayload | null {
  const metadata = paperMetadataPayload()
  if (!metadata.title || !metadata.subject) {
    generationError.value = 'Please enter a paper title and subject before generating.'
    return null
  }

  return {
    ...metadata,
    difficultyCoefficient: toBoundedNumber(generationForm.difficultyCoefficient, 0.5, 0, 1),
    questionType: generationForm.questionType,
    ownQuestionsOnly: bankMode.value === 'mine'
  }
}

function normalizePaperQuestion (question: ApiPaperQuestion): PaperQuestion {
  const normalized = normalizeQuestion(question)
  return {
    ...normalized,
    marks: toOptionalPositiveInteger(question.marks),
    orderNo: toOptionalPositiveInteger(question.orderNo)
  }
}

function setPaperQuestions (questions: ApiPaperQuestion[]) {
  paper.questions.splice(0, paper.questions.length, ...questions.map(normalizePaperQuestion))
}

function rememberSavedPaper (paperId: number) {
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
    rememberSavedPaper(response.data.paper.id)
    generationDiagnostics.value = response.data.diagnostics
    exported.value = false
    downloadError.value = ''
  } catch (error) {
    generationError.value = apiErrorMessage(error, 'Failed to generate paper.')
  } finally {
    isGenerating.value = false
  }
}

function formatDistribution (distribution: Record<string, number>) {
  return Object.entries(distribution)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ') || '-'
}

function formatScoreWeight (weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

function toggleAnswer (id: number) {
  if (shownIds.has(id)) shownIds.delete(id)
  else shownIds.add(id)
}

function getEssayBlankStyle (question: Question) {
  return {
    minHeight: `${getEssayBlankHeightPx(question.essayBlankSpace)}px`
  }
}
</script>

<style scoped>
.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.bank-panel,
.paper-panel {
  min-width: 0;
}
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
}
.panel-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.panel-sub {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 4px;
}
.generation-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  background:
    linear-gradient(135deg, rgba(79, 110, 247, 0.08), rgba(34, 197, 94, 0.05)),
    var(--color-surface);
}
.generation-card__head {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}
.generation-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.generation-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.generation-section__head h3 {
  font-size: .9rem;
  font-weight: 700;
}
.generation-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 900px) {
  .generation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.setting-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}
.setting-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.setting-card--score {
  border-top: 3px solid var(--color-primary);
}
.setting-card--diff {
  border-top: 3px solid #22c55e;
}
.setting-card--type {
  border-top: 3px solid #8b5cf6;
}

.wheel-selector {
  display: flex;
  align-items: center;
  background: var(--color-border);
  padding: 4px;
  border-radius: 999px;
  gap: 4px;
  overflow-x: auto;
  margin-top: 8px;
}
.wheel-option {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-muted);
  text-align: center;
  white-space: nowrap;
  transition: all 0.2s ease;
  cursor: pointer;
}
.wheel-option:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.4);
}
.wheel-option--active {
  background: #ffffff;
  color: var(--color-primary);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.custom-score {
  width: 70px;
  border-radius: 999px;
  border: none;
  text-align: center;
  padding: 6px;
  font-size: 0.85rem;
  background: #ffffff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
}
.custom-score:focus {
  outline: 2px solid var(--color-primary-d);
}

.setting-card--small {
  padding: 10px 16px;
}
.form-range {
  width: 100%;
  accent-color: var(--color-primary);
  cursor: pointer;
  margin-top: 8px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  appearance: auto;
}
.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.generation-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 16px;
  margin-top: 18px;
  border-top: 1px solid var(--color-border);
}
.generation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  color: var(--color-muted);
  font-size: .82rem;
}
.summary-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid rgba(79, 110, 247, 0.16);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
}
.status-banner {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: #f8fafc;
  color: var(--color-muted);
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: .875rem;
}
.status-banner--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
@media (max-width: 900px) {
  .generation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .generation-grid {
    grid-template-columns: 1fr;
  }

  .generation-footer,
  .paper-actions {
    align-items: stretch;
    flex-direction: column;
  }
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
}
.paper-meta-field {
  flex: 1;
}
.q-list,
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
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}
.paper-q-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  border-color: var(--color-primary);
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
.q-option-label {
  font-weight: 700;
  color: var(--color-primary);
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
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: .75rem;
  color: var(--color-muted);
}
.icon-btn:hover:not(:disabled) {
  background: var(--color-bg);
  color: var(--color-text);
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
.empty-state,
.empty-paper {
  text-align: center;
  color: var(--color-muted);
}
.download-error {
  margin-top: 14px;
}
.export-preview {
  background: #fff;
  margin-top: 24px;
  overflow: hidden;
}
.export-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.export-preview-head h3 {
  margin-bottom: 6px;
}
.export-preview-head p {
  color: var(--color-muted);
  font-size: .875rem;
}
.export-preview-note {
  color: var(--color-muted);
  font-size: .875rem;
  margin-bottom: 16px;
}
.export-mode-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.export-section {
  margin-top: 18px;
}
.export-section-title {
  padding-bottom: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: .95rem;
  font-weight: 700;
}
.export-q-list {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.export-q-list li {
  font-size: .95rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.export-q-text {
  display: inline;
}
.export-mark {
  display: inline-block;
  margin-right: 8px;
  color: var(--color-muted);
  font-size: .82rem;
}
.export-options {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 16px;
}
.export-option {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}
.export-essay-space {
  margin-top: 14px;
}
.export-answer {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.export-image-thumb {
  max-width: 160px;
  max-height: 120px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.export-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
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

  .export-preview-head,
  .export-mode-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
@media (max-width: 560px) {
  .paper-actions .btn,
  .generation-footer .btn,
  .export-mode-actions .btn {
    width: 100%;
  }

  .paper-meta-row > .form-group {
    min-width: 100%;
  }

  .export-image-thumb {
    max-width: 100%;
    width: 100%;
  }
}
</style>



