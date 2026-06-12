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
            :can-edit="canEditQuestion(q)"
            :correction-count="correctionCounts[q.id] || 0"
            @toggle-answer="toggleAnswer"
            @toggle-question="toggleQuestion"
            @edit="openEditModal"
            @report="openCorrectionModal"
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
            <label class="form-label" htmlFor="paper-title">Paper Title</label>
            <input id="paper-title" v-model="paper.title" class="form-input" name="paperTitle" placeholder="e.g. Mid-term Examination 2026…" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group paper-meta-field">
              <label class="form-label" htmlFor="paper-subject">Subject</label>
              <input id="paper-subject" v-model="paper.subject" class="form-input" name="paperSubject" placeholder="e.g. Mathematics…" />
            </div>
            <div class="form-group paper-meta-field">
              <label class="form-label" htmlFor="paper-duration">Duration (min)</label>
              <input id="paper-duration" v-model.number="paper.duration" type="number" min="1" class="form-input" name="paperDuration" placeholder="60…" />
            </div>
          </div>
          <label v-if="canReadAnswers" class="export-toggle">
            <input v-model="includeAnswersInExport" type="checkbox" />
            <span>Include answers in exported paper</span>
          </label>
        </div>

        <form v-if="canWritePapers" class="card generation-card" @submit.prevent="generatePaper">
          <div class="gen-header">
            <div class="gen-header__text">
              <h2>Auto Generate</h2>
              <p>Use a genetic algorithm to compose a balanced paper from the question bank.</p>
            </div>
            <Transition name="gen-stat-pop">
              <div v-if="generationDiagnostics" class="gen-fitness-badge" :class="fitnessClass" :title="'Generations run: ' + generationDiagnostics.generationsRun">
                <span class="gen-fitness-value">{{ generationDiagnostics.fitness.toFixed(2) }}</span>
                <span class="gen-fitness-label">fitness</span>
              </div>
            </Transition>
          </div>

          <div class="gen-controls">
            <div class="gen-field">
              <label class="form-label">Subjects</label>
              <div v-if="availableSubjects.length" class="gen-subject-pool">
                <button
                  v-for="subject in availableSubjects"
                  :key="subject"
                  type="button"
                  class="gen-subject-chip"
                  :class="{ 'gen-subject-chip--active': generationForm.subjects.includes(subject) }"
                  @click="toggleSubject(subject)"
                >{{ subject }}</button>
              </div>
              <div v-else-if="isLoadingMeta" class="gen-subject-loading" aria-live="polite">
                Loading subjects…
              </div>
              <p v-else class="form-hint">No subjects available. Create questions with subjects first.</p>
            </div>

            <div class="gen-field">
              <label class="form-label">Total Score</label>
              <div class="gen-pill-group">
                <button
                  v-for="score in [50, 100, 120, 150]"
                  :key="score"
                  type="button"
                  class="gen-pill"
                  :class="{ 'gen-pill--active': paper.totalMarks === score }"
                  @click="paper.totalMarks = score"
                >{{ score }}</button>
                <input
                  v-model.number="paper.totalMarks"
                  class="gen-pill-input"
                  type="number"
                  min="1"
                  placeholder="Custom"
                />
              </div>
            </div>

            <div class="gen-field">
              <label class="form-label">Question Type</label>
              <div
                class="gen-type-list"
                role="listbox"
                aria-label="Question types"
                aria-multiselectable="true"
              >
                <button
                  v-for="type in QUESTION_TYPE_ORDER"
                  :key="type"
                  type="button"
                  class="gen-type-option"
                  :class="{ 'gen-type-option--active': generationForm.questionTypes.includes(type) }"
                  role="option"
                  :aria-selected="generationForm.questionTypes.includes(type)"
                  @click="toggleQuestionType(type)"
                >
                  <span class="gen-type-option-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
                  <span v-if="generationForm.questionTypes.includes(type)" class="gen-type-option-check">✓</span>
                </button>
              </div>
              <div v-if="generationForm.questionTypes.length" class="gen-type-counts">
                <div v-for="type in generationForm.questionTypes" :key="type" class="gen-type-count-row">
                  <span class="gen-type-count-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
                  <input
                    v-model.number="generationForm.typeCounts[type]"
                    class="gen-type-count-input"
                    type="number"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div class="gen-field">
              <div class="gen-field__label-row">
                <label class="form-label">Difficulty</label>
                <span class="gen-diff-badge" :class="difficultyBadgeClass">{{ difficultyLabel }}</span>
              </div>
              <div class="gen-range-wrap">
                <input
                  v-model.number="generationForm.difficultyCoefficient"
                  class="gen-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                />
                <div class="gen-range-ticks">
                  <span>Easy</span>
                  <span>Medium</span>
                  <span>Hard</span>
                </div>
              </div>
            </div>

            <div class="gen-field">
              <label class="form-label">Tag Filters <span class="gen-optional">(optional)</span></label>
              <div v-if="availableTags.length" class="gen-tag-pool">
                <button
                  v-for="tag in availableTags"
                  :key="tag"
                  type="button"
                  class="gen-tag-chip"
                  :class="tagChipClass(tag)"
                  @click="toggleTag($event, tag)"
                >{{ tag }}</button>
              </div>
              <div v-else-if="isLoadingMeta" class="gen-tag-loading" aria-live="polite">
                Loading tags…
              </div>
              <div v-if="selectedTagsDisplay.length" class="gen-selected-tags">
                <span
                  v-for="tag in selectedTagsDisplay"
                  :key="tag.value"
                  class="gen-selected-pill"
                  :class="'gen-spill--' + tag.group"
                >
                  {{ tag.value }}
                  <button type="button" class="gen-pill-remove" @click="removeTag(tag.value)" aria-label="Remove">×</button>
                </span>
              </div>
              <input
                v-model="generationForm.customTagInput"
                class="form-input gen-tag-input"
                placeholder="Type custom tag and press Enter…"
                @keydown.enter.prevent="addCustomTag"
              />
              <p class="form-hint">Click a tag to add as Required; Shift+click for Preferred. Tap × to remove.</p>
            </div>
          </div>

          <div class="gen-action">
            <button
              class="btn btn-primary gen-submit"
              type="submit"
              :disabled="isGenerating || !generationForm.subjects.length || !paper.title.trim() || !generationForm.questionTypes.length"
            >
              <span v-if="isGenerating" class="gen-spinner"></span>
              {{ isGenerating ? 'Generating…' : 'Generate Paper' }}
            </button>
            <span class="form-hint">Uses the paper title, duration, and the generation subject above.</span>
          </div>

          <Transition name="gen-banner">
            <div v-if="generationError" class="status-banner status-banner--error" aria-live="polite">
              {{ generationError }}
            </div>
          </Transition>

          <Transition name="gen-banner">
            <div v-if="generationDiagnostics" class="gen-result">
              <div class="gen-result-header">
                <span class="gen-result-title">Generation Result</span>
                <span class="gen-result-meta">{{ generationDiagnostics.questionCount }} questions · {{ generationDiagnostics.candidateCount }} candidates · {{ generationDiagnostics.generationsRun }} generations</span>
              </div>
              <div class="gen-stats">
                <div class="gen-stat">
                  <span class="gen-stat-label">Marks</span>
                  <span class="gen-stat-value">{{ generationDiagnostics.marksActual }}</span>
                </div>
                <div class="gen-stat">
                  <span class="gen-stat-label">Weight</span>
                  <span class="gen-stat-value">{{ generationDiagnostics.scoreWeightActual }}</span>
                </div>
                <div class="gen-stat">
                  <span class="gen-stat-label">Difficulty</span>
                  <span class="gen-stat-value gen-stat--small">{{ formatDistribution(generationDiagnostics.difficultyActual) }}</span>
                </div>
                <div class="gen-stat">
                  <span class="gen-stat-label">Type</span>
                  <span class="gen-stat-value gen-stat--small">{{ formatDistribution(generationDiagnostics.typeActual) }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </form>
        <div v-else class="card generation-card">
          <div class="gen-header">
            <div class="gen-header__text">
              <h2>Auto Generate</h2>
              <p>Paper generation requires <strong>papers:write</strong> permission.</p>
            </div>
          </div>
        </div>

        <Transition name="fade" mode="out-in">
          <TransitionGroup name="list" tag="div" class="paper-question-list" v-if="paper.questions.length">
            <div v-for="(q, idx) in paper.questions" :key="q.id" class="paper-q-item card">
              <div class="paper-q-controls">
                <button class="icon-btn" :disabled="idx === 0" @click="moveUp(idx)" aria-label="Move question up">Up</button>
                <button class="icon-btn" :disabled="idx === paper.questions.length - 1" @click="moveDown(idx)" aria-label="Move question down">Down</button>
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
                      loading="lazy"
                    />
                  </div>

                  <div v-if="includeAnswersInExport && canReadAnswers" class="export-answer">
                    <strong>Answer:</strong>
                    <template v-if="Array.isArray(q.answer)">
                      {{ q.answer.join(', ') }}
                    </template>
                    <template v-else v-for="(part, i) in parseLatexParts(q.answer)" :key="i">
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

  <EditQuestionModal
    v-if="editingQuestion"
    :question="editingQuestion"
    :visible="!!editingQuestion"
    @close="closeEditModal"
    @saved="onQuestionEdited"
  />

  <QuestionCorrectionModal
    v-if="reportingQuestion"
    :question="reportingQuestion"
    :visible="!!reportingQuestion"
    @close="closeCorrectionModal"
    @submitted="onCorrectionSubmitted"
  />
</template>

<script setup lang="ts">
import PaginationControls from '~/components/questions/PaginationControls.vue'
import QuestionBankCard from '~/components/questions/QuestionBankCard.vue'
import QuestionBankToolbar from '~/components/questions/QuestionBankToolbar.vue'
import type { Question, QuestionDifficulty, QuestionEntity, QuestionType } from '~/types/question'
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
  myQuestionPagination,
  availableSubjects,
  availableTags,
  loadMeta,
  isLoadingMeta,
  fetchCorrections
} = useQuestionBank()
const { hasPermission, isAuthReady, user } = useAuth()
const { apiFetch, getApiBase, refreshSessionCookie } = useApi()
const route = useRoute()
const router = useRouter()
type ExportMode = 'paper' | 'categorized'
type BankMode = 'all' | 'mine'
interface GenerationFormState {
  difficultyCoefficient: number
  questionTypes: QuestionType[]
  typeCounts: Record<string, number>
  subjects: string[]
  requiredTagsStr: string
  requiredTags: string[]
  preferredTagsStr: string
  preferredTags: string[]
  customTagInput: string
}

const DEFAULT_PAPER = {
  duration: 60,
  totalMarks: 100
}

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
function isShown (id: number) { return shownIds.has(id) }
const exportMode = ref<ExportMode>('paper')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>(parseQueryBank())
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

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)
const correctionCounts = reactive<Record<number, number>>({})

const canReadQuestions = computed(() => hasPermission('questions:read'))
const canWritePapers = computed(() => hasPermission('papers:write'))
const isAdmin = computed(() => hasPermission('users:manage'))

function canEditQuestion (q: Question) {
  if (!hasPermission('questions:write')) return false
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
      void loadCurrentPage(1)
      void loadMeta()
    }
  },
  { immediate: true }
)

watch([search, filterSubject, filterDifficulty], () => {
  if (import.meta.client) {
    syncQuery()
    if (canReadQuestions.value) void loadCurrentPage(1)
  }
})

watch([bankMode], () => {
  syncQuery()
})

function syncQuery() {
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

function typeLabel (type: Question['type']) {
  return QUESTION_TYPE_LABELS[type] || type
}

const subjects = computed(() => availableSubjects.value)

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
  if (!window.confirm('Clear all questions from the paper? This cannot be undone.')) return
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

import { boundedNumber, optionalPositiveInteger } from '~/domain/questions'

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

function tagChipClass (tag: string) {
  if (generationForm.requiredTags.includes(tag)) return 'gen-chip--required'
  if (generationForm.preferredTags.includes(tag)) return 'gen-chip--preferred'
  return ''
}

function toggleQuestionType (type: QuestionType) {
  const index = generationForm.questionTypes.indexOf(type)
  if (index === -1) {
    generationForm.questionTypes = [...generationForm.questionTypes, type]
    generationForm.typeCounts = { ...generationForm.typeCounts, [type]: generationForm.typeCounts[type] || 1 }
  } else {
    generationForm.questionTypes = generationForm.questionTypes.filter(t => t !== type)
    const newCounts = { ...generationForm.typeCounts }
    delete newCounts[type]
    generationForm.typeCounts = newCounts
  }
}

function toggleSubject (subject: string) {
  const index = generationForm.subjects.indexOf(subject)
  if (index === -1) {
    generationForm.subjects = [...generationForm.subjects, subject]
  } else {
    generationForm.subjects = generationForm.subjects.filter(s => s !== subject)
  }
}

function toggleTag (event: MouseEvent, tag: string) {
  const shift = event.shiftKey
  if (generationForm.requiredTags.includes(tag)) {
    generationForm.requiredTags = generationForm.requiredTags.filter(t => t !== tag)
  } else if (generationForm.preferredTags.includes(tag)) {
    generationForm.preferredTags = generationForm.preferredTags.filter(t => t !== tag)
  } else if (shift) {
    generationForm.preferredTags = [...generationForm.preferredTags, tag]
  } else {
    generationForm.requiredTags = [...generationForm.requiredTags, tag]
  }
}

function removeTag (tag: string) {
  generationForm.requiredTags = generationForm.requiredTags.filter(t => t !== tag)
  generationForm.preferredTags = generationForm.preferredTags.filter(t => t !== tag)
}

const selectedTagsDisplay = computed(() => {
  const display: { value: string; group: string }[] = []
  for (const tag of generationForm.requiredTags) {
    if (!display.some(d => d.value === tag)) display.push({ value: tag, group: 'required' })
  }
  for (const tag of generationForm.preferredTags) {
    const existing = display.find(d => d.value === tag)
    if (existing) existing.group = 'both'
    else display.push({ value: tag, group: 'preferred' })
  }
  return display
})

function addCustomTag () {
  const input = generationForm.customTagInput.trim()
  if (!input) return
  const tags = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  for (const tag of tags) {
    if (!generationForm.requiredTags.includes(tag) && !generationForm.preferredTags.includes(tag)) {
      generationForm.requiredTags = [...generationForm.requiredTags, tag]
    }
  }
  generationForm.customTagInput = ''
}

const fitnessClass = computed(() => {
  if (!generationDiagnostics.value) return ''
  const f = generationDiagnostics.value.fitness
  if (f >= 0.85) return 'gen-fitness--high'
  if (f >= 0.60) return 'gen-fitness--mid'
  return 'gen-fitness--low'
})

const difficultyLabel = computed(() => {
  const coeff = generationForm.difficultyCoefficient
  if (coeff <= 0.3) return 'Easy'
  if (coeff <= 0.55) return 'Easy-Medium'
  if (coeff <= 0.75) return 'Medium-Hard'
  return 'Hard'
})

const difficultyBadgeClass = computed(() => {
  const coeff = generationForm.difficultyCoefficient
  if (coeff <= 0.3) return 'badge-easy'
  if (coeff <= 0.55) return 'badge-medium'
  return 'badge-hard'
})

import { formatScoreWeight } from '~/utils/format'

function toggleAnswer (id: number) {
  if (shownIds.has(id)) shownIds.delete(id)
  else shownIds.add(id)
}

function getEssayBlankStyle (question: Question) {
  return {
    minHeight: `${getEssayBlankHeightPx(question.essayBlankSpace)}px`
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

async function onCorrectionSubmitted () {
  if (reportingQuestion.value) {
    await loadCorrectionCount(reportingQuestion.value.id)
  }
}

async function loadCorrectionCount (questionId: number) {
  try {
    const corrections = await fetchCorrections(questionId)
    const openCount = corrections.filter(c => c.status === 'open').length
    correctionCounts[questionId] = openCount
  } catch {
    correctionCounts[questionId] = 0
  }
}

watch(currentQuestions, (newQuestions) => {
  for (const q of newQuestions) {
    void loadCorrectionCount(q.id)
  }
}, { immediate: true })
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
    linear-gradient(135deg, rgba(79, 110, 247, 0.06), rgba(34, 197, 94, 0.03)),
    var(--color-surface);
}

.gen-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
.gen-header__text h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.gen-header__text p {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 3px;
}

.gen-fitness-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: 6px 14px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  flex-shrink: 0;
}
.gen-fitness--high {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}
.gen-fitness--mid {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.25);
}
.gen-fitness--low {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
}
.gen-fitness-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}
.gen-fitness--high .gen-fitness-value { color: #15803d; }
.gen-fitness--mid .gen-fitness-value { color: #a16207; }
.gen-fitness--low .gen-fitness-value { color: #b91c1c; }
.gen-fitness-label {
  font-size: .65rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.gen-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 20px;
}

.gen-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gen-field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.gen-diff-badge {
  flex-shrink: 0;
}
.gen-optional {
  font-weight: 400;
  color: var(--color-muted);
  font-size: .8rem;
}

.gen-pill-group {
  display: flex;
  align-items: center;
  background: var(--color-border);
  padding: 3px;
  border-radius: 999px;
  gap: 2px;
  overflow-x: auto;
}
.gen-pill {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: .82rem;
  font-weight: 500;
  color: var(--color-muted);
  text-align: center;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
  cursor: pointer;
}
.gen-pill:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.45);
}
.gen-pill--active {
  background: #ffffff;
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.gen-pill-input {
  width: 64px;
  border-radius: 999px;
  border: none;
  text-align: center;
  padding: 5px;
  font-size: .82rem;
  font-weight: 500;
  background: #ffffff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s ease;
}
.gen-pill-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.gen-type-list {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
.gen-type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 6px 14px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-size: .85rem;
  font-weight: 500;
  color: var(--color-muted);
  transition: background 0.2s ease, color 0.2s ease;
  text-align: left;
  width: 100%;
}
.gen-type-option:last-child {
  border-bottom: none;
}
.gen-type-option:hover {
  background: rgba(79, 110, 247, 0.04);
  color: var(--color-text);
}
.gen-type-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 0;
}
.gen-type-option--active {
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
  border-left: 3px solid var(--color-primary);
}
.gen-type-option--active:hover {
  background: rgba(79, 110, 247, 0.1);
}
.gen-type-option-label {
  flex: 1;
}
.gen-type-option-check {
  font-size: .7rem;
  color: var(--color-accent);
  font-weight: 700;
  flex-shrink: 0;
}

.gen-type-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.gen-type-count-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-border);
  border-radius: 999px;
  padding: 2px 2px 2px 12px;
}

.gen-type-count-label {
  font-size: .78rem;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
}

.gen-type-count-input {
  width: 48px;
  border-radius: 999px;
  border: none;
  text-align: center;
  padding: 4px 6px;
  font-size: .82rem;
  font-weight: 500;
  background: #ffffff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s ease;
}

.gen-type-count-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.gen-range-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gen-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #22c55e, #eab308, #ef4444);
  appearance: none;
  cursor: pointer;
}
.gen-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: #ffffff;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  transition: transform 0.15s ease;
}
.gen-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.gen-range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: .7rem;
  color: var(--color-muted);
  padding: 0 2px;
}

.gen-tag-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}
.gen-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.gen-tag-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
}
.gen-chip--required {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}
.gen-chip--preferred {
  border-color: var(--color-accent);
  background: rgba(34, 197, 94, 0.08);
  color: #15803d;
  font-weight: 600;
}

.gen-tag-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
}

.gen-subject-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}
.gen-subject-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.gen-subject-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
}
.gen-subject-chip--active {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}
.gen-subject-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
}

.gen-selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.gen-selected-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 500;
}
.gen-spill--required {
  background: rgba(79, 110, 247, 0.12);
  color: var(--color-primary);
  border: 1px solid rgba(79, 110, 247, 0.25);
}
.gen-spill--preferred {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.gen-spill--both {
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.12), rgba(34, 197, 94, 0.12));
  color: var(--color-text);
  border: 1px solid rgba(79, 110, 247, 0.25);
}
.gen-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: .85rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}
.gen-pill-remove:hover {
  opacity: 1;
}

.gen-tag-input {
  font-size: .82rem;
  margin-top: 8px;
}

.gen-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 16px;
  margin-top: 2px;
  border-top: 1px solid var(--color-border);
}
.gen-submit {
  min-width: 160px;
  justify-content: center;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.gen-submit:not(:disabled) {
  animation: genPulse 2.5s ease-in-out infinite;
}
@keyframes genPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.25); }
  50% { box-shadow: 0 0 0 6px rgba(79, 110, 247, 0); }
}
.gen-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: genSpin 0.6s linear infinite;
}
@keyframes genSpin {
  to { transform: rotate(360deg); }
}

.gen-result {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.gen-result-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.gen-result-title {
  font-size: .85rem;
  font-weight: 700;
  color: var(--color-text);
}
.gen-result-meta {
  font-size: .75rem;
  color: var(--color-muted);
}
.gen-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.gen-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: var(--radius);
  background: rgba(79, 110, 247, 0.04);
  border: 1px solid rgba(79, 110, 247, 0.08);
}
.gen-stat-label {
  font-size: .68rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.gen-stat-value {
  font-size: .95rem;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.gen-stat--small {
  font-size: .75rem;
  font-weight: 600;
  text-align: center;
}

.gen-stat-pop-enter-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.gen-stat-pop-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.gen-stat-pop-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.gen-stat-pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.gen-banner-enter-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.gen-banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.gen-banner-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.gen-banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
@media (max-width: 560px) {
  .gen-tag-pool {
    max-height: 200px;
  }

  .gen-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .gen-action,
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
  .gen-action .btn,
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

.subject-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
}
</style>



