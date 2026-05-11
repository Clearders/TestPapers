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

        <div v-if="activeLoading" class="status-banner">
          Loading questions...
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

        <div class="card" style="margin-bottom:16px">
          <div class="form-group">
            <label class="form-label">Paper Title</label>
            <input v-model="paper.title" class="form-input" placeholder="e.g. Mid-term Examination 2026" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Subject</label>
              <input v-model="paper.subject" class="form-input" placeholder="e.g. Mathematics" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Duration (min)</label>
              <input v-model.number="paper.duration" type="number" min="1" class="form-input" placeholder="60" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Total Marks</label>
              <input v-model.number="paper.totalMarks" type="number" min="1" class="form-input" placeholder="100" />
            </div>
          </div>
          <label v-if="canReadAnswers" class="export-toggle">
            <input v-model="includeAnswersInExport" type="checkbox" />
            <span>Include answers in exported paper</span>
          </label>
        </div>

        <form class="card generation-card" @submit.prevent="generatePaper">
          <div class="panel-head">
            <div>
              <h2>Auto Generate</h2>
              <p class="panel-sub">Use a genetic algorithm to compose a balanced paper from the question bank.</p>
            </div>
            <span v-if="generationDiagnostics" class="tag count-tag">fitness {{ generationDiagnostics.fitness }}</span>
          </div>

          <div class="generation-grid">
            <div class="form-group compact-field">
              <label class="form-label">Allocation</label>
              <select v-model="generationForm.allocationMode" class="form-input">
                <option value="question_count">By Question Count</option>
                <option value="total_score">By Total Marks</option>
              </select>
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Questions</label>
              <input
                v-model.number="generationForm.questionCount"
                class="form-input"
                type="number"
                min="1"
                max="100"
                :disabled="generationForm.allocationMode === 'total_score'"
              />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Easy</label>
              <input v-model.number="generationForm.easy" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Medium</label>
              <input v-model.number="generationForm.medium" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Hard</label>
              <input v-model.number="generationForm.hard" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Population</label>
              <input v-model.number="generationForm.populationSize" class="form-input" type="number" min="20" max="500" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Generations</label>
              <input v-model.number="generationForm.generations" class="form-input" type="number" min="10" max="1000" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Crossover</label>
              <input v-model.number="generationForm.crossoverRate" class="form-input" type="number" min="0" max="1" step="0.01" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">Mutation</label>
              <input v-model.number="generationForm.mutationRate" class="form-input" type="number" min="0" max="1" step="0.01" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Required Tags</label>
            <input v-model="generationForm.requiredTags" class="form-input" placeholder="comma-separated tags, optional" />
          </div>

          <div class="form-group">
            <label class="form-label">Optional Tags</label>
            <div class="tag-picker">
              <div class="tag-search-row">
                <input
                  v-model="tagSearch"
                  class="form-input"
                  placeholder="Search optional tags"
                />
                <button
                  v-if="generationForm.optionalTags.length"
                  class="btn btn-outline btn-sm"
                  type="button"
                  @click="clearOptionalTags"
                >
                  Clear
                </button>
              </div>

              <div v-if="generationForm.optionalTags.length" class="tag-button-row">
                <button
                  v-for="tag in generationForm.optionalTags"
                  :key="tag"
                  class="tag tag-button tag-button--selected"
                  type="button"
                  :title="`Remove ${tag}`"
                  @click="removeOptionalTag(tag)"
                >
                  {{ tag }} <span aria-hidden="true">x</span>
                </button>
              </div>

              <div v-if="filteredOptionalTagOptions.length" class="tag-button-row">
                <button
                  v-for="tag in filteredOptionalTagOptions"
                  :key="tag"
                  class="tag tag-button"
                  type="button"
                  :title="`Prefer ${tag}`"
                  @click="addOptionalTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>

              <span v-else-if="isLoadingTags" class="form-hint">Loading tags...</span>
              <span v-else-if="tagError" class="form-hint form-hint--error">{{ tagError }}</span>
              <span v-else class="form-hint">No matching optional tags.</span>
            </div>
          </div>

          <div class="paper-actions">
            <button class="btn btn-primary" type="submit" :disabled="isGenerating || !paper.title || !paper.subject">
              {{ isGenerating ? 'Generating...' : 'Generate Paper' }}
            </button>
            <span class="form-hint">Uses the current paper title, subject, duration, and total marks.</span>
          </div>

          <div v-if="generationError" class="status-banner status-banner--error">
            {{ generationError }}
          </div>
          <div v-if="generationDiagnostics" class="generation-summary">
            <span>Difficulty: {{ formatDistribution(generationDiagnostics.difficultyActual) }}</span>
            <span>Types: {{ formatDistribution(generationDiagnostics.typeActual) }}</span>
            <span v-if="generationDiagnostics.marksActual">Marks: {{ generationDiagnostics.marksActual }}</span>
            <span v-if="generationDiagnostics.scoreWeightActual">Weight: {{ generationDiagnostics.scoreWeightActual }}</span>
            <span v-if="generationDiagnostics.optionalTags?.length">
              Optional tags: {{ formatTagCoverage(generationDiagnostics.coveredOptionalTags, generationDiagnostics.optionalTags) }}
            </span>
            <span>Candidates: {{ generationDiagnostics.candidateCount }}</span>
          </div>
        </form>

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

        <div class="paper-actions" style="margin-top:20px">
          <button class="btn btn-success" :disabled="!paper.questions.length || !paper.title" @click="exportPaper">
            Export Paper
          </button>
          <button class="btn btn-primary" :disabled="!canDownloadDocx" @click="downloadDocx">
            {{ isDownloadingDocx ? 'Preparing DOCX...' : 'Download DOCX' }}
          </button>
          <button class="btn btn-outline" :disabled="!paper.questions.length" @click="clearPaper">
            Clear All
          </button>
        </div>

        <div v-if="downloadError" class="status-banner status-banner--error" style="margin-top:14px">
          {{ downloadError }}
        </div>

        <Transition name="fade">
          <div v-if="exported" class="export-preview card" style="margin-top:24px">
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
            <p style="color:var(--color-muted);font-size:.875rem;margin-bottom:16px">
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

                  <div v-if="(q.type === 'choice' || q.type === 'true_false') && q.options?.length" class="export-options">
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
import { DEFAULT_ESSAY_BLANK_SPACE, QUESTION_TYPE_LABELS, type Question } from '~/composables/useQuestionBank'

interface GenerationDiagnostics {
  fitness: number
  candidateCount: number
  difficultyActual: Record<string, number>
  typeActual: Record<string, number>
  optionalTags?: string[]
  coveredOptionalTags?: string[]
  allocationMode?: string
  scoreWeightActual?: number
  marksActual?: number
}

type PaperQuestion = Question & { marks?: number; orderNo?: number }

interface GeneratedPaperResponse {
  paper: {
    id: number
    title: string
    subject: string
    duration: number
    totalMarks: number
    questions: PaperQuestion[]
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
type AllocationMode = 'question_count' | 'total_score'

const search = ref('')
const filterSubject = ref('')
const filterDifficulty = ref<QuestionDifficulty | ''>('')
// Use Set for O(1) lookup and toggle
const shownIds = reactive(new Set<number>())
function isShown (id: number) { return shownIds.has(id) }
const exportMode = ref<ExportMode>('paper')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>('all')
const pageSize = ref(20)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)
const tagOptions = ref<string[]>([])
const tagSearch = ref('')
const isLoadingTags = ref(false)
const tagError = ref('')
const savedPaperId = ref<number | null>(null)
const savedPaperSignature = ref('')
const isDownloadingDocx = ref(false)
const downloadError = ref('')

const paper = reactive({
  title: '',
  subject: '',
  duration: 60,
  totalMarks: 100,
  questions: [] as PaperQuestion[]
})

const exported = ref(false)
const questionTypeOrder: QuestionType[] = ['choice', 'true_false', 'blank', 'short_answer', 'essay']

const canReadQuestions = computed(() => hasPermission('questions:read'))

const generationForm = reactive({
  allocationMode: 'question_count' as AllocationMode,
  questionCount: 5,
  easy: 2,
  medium: 2,
  hard: 1,
  populationSize: 80,
  generations: 120,
  crossoverRate: 0.85,
  mutationRate: 0.08,
  requiredTags: '',
  optionalTags: [] as string[]
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
      void loadTagOptions()
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

const selectedOptionalTagKeys = computed(() => {
  return new Set(generationForm.optionalTags.map(tag => tag.toLowerCase()))
})

const filteredOptionalTagOptions = computed(() => {
  const keyword = tagSearch.value.trim().toLowerCase()
  return tagOptions.value
    .filter((tag) => {
      const tagKey = tag.toLowerCase()
      return !selectedOptionalTagKeys.value.has(tagKey) && (!keyword || tagKey.includes(keyword))
    })
    .slice(0, 12)
})

const exportSections = computed(() => {
  if (exportMode.value !== 'categorized') {
    return [{ key: 'paper', title: '', questions: paper.questions, start: 1 }]
  }

  // Single pass categorization - avoid multiple filter() calls
  const byType = new Map<QuestionType, PaperQuestion[]>()
  for (const q of paper.questions) {
    const list = byType.get(q.type)
    if (list) list.push(q)
    else byType.set(q.type, [q])
  }

  const sections: { key: string; title: string; questions: PaperQuestion[]; start: number }[] = []
  let start = 1
  for (const type of questionTypeOrder) {
    const questions = byType.get(type)
    if (!questions || !questions.length) continue
    sections.push({ key: type, title: QUESTION_TYPE_LABELS[type], questions, start })
    start += questions.length
  }
  return sections
})

// Faster lookup via cached Set
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
  // Use push instead of spread for better memory efficiency
  paper.questions.push(question)
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
  savedPaperId.value = null
  savedPaperSignature.value = ''
  downloadError.value = ''
}

function exportPaper () {
  exported.value = true
}

function getPaperPayload () {
  return {
    title: paper.title.trim(),
    subject: paper.subject.trim(),
    duration: Number(paper.duration) || 60,
    totalMarks: Number(paper.totalMarks) || 100,
    questions: paper.questions.map((question, index) => ({
      questionId: question.id,
      orderNo: index + 1,
      marks: question.marks
    }))
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

async function loadTagOptions () {
  if (isLoadingTags.value || tagOptions.value.length) return

  isLoadingTags.value = true
  tagError.value = ''
  try {
    const response = await apiFetch<string[]>('/meta/tags', { method: 'GET' })
    tagOptions.value = Array.from(new Set((response.data || []).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  } catch (error) {
    tagError.value = error instanceof Error ? error.message : 'Failed to load tags.'
  } finally {
    isLoadingTags.value = false
  }
}

function addOptionalTag (tag: string) {
  const normalized = tag.trim()
  if (!normalized || selectedOptionalTagKeys.value.has(normalized.toLowerCase())) return
  generationForm.optionalTags.push(normalized)
  tagSearch.value = ''
}

function removeOptionalTag (tag: string) {
  const index = generationForm.optionalTags.findIndex(item => item.toLowerCase() === tag.toLowerCase())
  if (index !== -1) generationForm.optionalTags.splice(index, 1)
}

function clearOptionalTags () {
  generationForm.optionalTags.length = 0
}

async function generatePaper () {
  generationError.value = ''
  generationDiagnostics.value = null
  isGenerating.value = true

  try {
    const response = await apiFetch<GeneratedPaperResponse>('/papers/generate', {
      method: 'POST',
      body: {
        title: paper.title,
        subject: paper.subject,
        duration: paper.duration,
        totalMarks: paper.totalMarks,
        allocationMode: generationForm.allocationMode,
        questionCount: generationForm.allocationMode === 'question_count' ? generationForm.questionCount : undefined,
        difficultyTargets: {
          easy: generationForm.easy,
          medium: generationForm.medium,
          hard: generationForm.hard
        },
        requiredTags: generationForm.requiredTags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        optionalTags: [...generationForm.optionalTags],
        subjectStrict: true,
        algorithm: {
          populationSize: generationForm.populationSize,
          generations: generationForm.generations,
          crossoverRate: generationForm.crossoverRate,
          mutationRate: generationForm.mutationRate,
          elitismCount: 4,
          tournamentSize: 3
        }
      }
    })

    paper.title = response.data.paper.title
    paper.subject = response.data.paper.subject
    paper.duration = response.data.paper.duration
    paper.totalMarks = response.data.paper.totalMarks
    paper.questions = response.data.paper.questions
    savedPaperId.value = response.data.paper.id
    savedPaperSignature.value = getPaperSignature()
    generationDiagnostics.value = response.data.diagnostics
    exported.value = false
    downloadError.value = ''
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : 'Failed to generate paper.'
  } finally {
    isGenerating.value = false
  }
}

function formatDistribution (distribution: Record<string, number>) {
  return Object.entries(distribution)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ') || '-'
}

function formatTagCoverage (covered: string[] = [], requested: string[] = []) {
  return `${covered.length}/${requested.length} covered`
}

function formatScoreWeight (weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

function toggleAnswer (id: number) {
  if (shownIds.has(id)) shownIds.delete(id)
  else shownIds.add(id)
}

function getEssayBlankStyle (question: Question) {
  const blankSpace = question.essayBlankSpace ?? DEFAULT_ESSAY_BLANK_SPACE
  const lineHeight = Math.max(20, blankSpace.lineHeight)
  const minHeight = Math.max(1, blankSpace.lines) * lineHeight

  return {
    minHeight: `${minHeight}px`
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
@media (max-width: 900px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }
  .generation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  margin-bottom: 16px;
}
.generation-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.compact-field {
  margin-bottom: 0;
}
.generation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
  color: var(--color-muted);
  font-size: .82rem;
}
.tag-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tag-search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.tag-search-row .form-input {
  flex: 1;
  min-width: 0;
}
.tag-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-button {
  border: 1px solid #c7d2fe;
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}
.tag-button:hover {
  background: #dbe4ff;
  border-color: var(--color-primary);
}
.tag-button--selected {
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
}
.tag-button--selected:hover {
  background: #bbf7d0;
  border-color: #22c55e;
}
.form-hint--error {
  color: #b91c1c;
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
.count-tag,
.tag-count {
  background: #eff3fe;
  color: var(--color-primary);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
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
.q-list,
.paper-question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}
.q-card,
.paper-q-item {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.q-card:hover,
.paper-q-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  border-color: var(--color-primary);
}
.q-card-header,
.q-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.q-id {
  font-size: .8rem;
  color: var(--color-muted);
}
.q-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.q-text,
.q-text-wrap {
  font-size: .95rem;
  line-height: 1.7;
}
.q-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-option {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.q-option-label {
  font-weight: 700;
  color: var(--color-primary);
}
.q-source {
  font-size: .82rem;
  color: var(--color-muted);
}
.q-footer,
.paper-actions,
.paper-meta-row,
.export-toggle {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
.q-answer-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.3s ease, opacity 0.3s ease;
}
.q-answer-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.q-answer-inner {
  overflow: hidden;
}
.q-answer {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: .9rem;
}
.paper-q-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
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
}
.paper-q-num {
  min-width: 28px;
  font-weight: 700;
  color: var(--color-primary);
}
.paper-q-content {
  flex: 1;
}
.remove-btn {
  white-space: nowrap;
}
.empty-state,
.empty-paper {
  text-align: center;
  color: var(--color-muted);
}
.export-preview {
  background: #fff;
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
.q-type-tag {
  display: inline-block;
  font-size: .7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-primary);
  background: #eff3fe;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
  vertical-align: middle;
}
.q-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.q-image-thumb,
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
.bank-mode-tabs {
  display: flex;
  gap: 8px;
}
</style>

