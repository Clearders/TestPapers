<template>
  <section>
    <h1 class="page-title">{{ $t('workspace.title') }}</h1>
    <p class="page-sub">{{ $t('workspace.subtitle') }}</p>

    <div v-if="!canReadQuestions" class="card permission-card">
      <h2>{{ $t('workspace.loginRequired') }}</h2>
      <p>{{ $t('workspace.loginRequiredMessage') }}</p>
      <NuxtLink to="/login" class="btn btn-primary">{{ $t('common.login') }}</NuxtLink>
    </div>

    <div v-else class="workspace-layout">
      <div class="bank-panel">
        <div class="panel-head">
          <div>
            <h2>{{ $t('workspace.questionBank') }}</h2>
            <p class="panel-sub">{{ $t('workspace.bankSubtitle') }}</p>
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
          {{ $t('workspace.loadingQuestions') }}
        </div>

        <TransitionGroup name="list" tag="div" class="q-list" v-if="currentQuestions.length">
          <QuestionBankCard
            v-for="(q, index) in currentQuestions"
            :key="q.id"
            :question="q"
            :index="index"
            :can-read-answers="canReadAnswers"
            :is-shown="shown.has(q.id)"
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
            <p>{{ $t('common.noResults') }}</p>
            <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">{{ $t('index.createProblem') }}</NuxtLink>
          </div>
        </Transition>
      </div>

      <div class="paper-panel">
        <div class="panel-head">
          <div>
            <h2>{{ $t('workspace.paperBuilder') }}</h2>
            <p class="panel-sub">{{ $t('workspace.paperSubtitle') }}</p>
          </div>
          <span class="badge tag-count">
            {{ $t('workspace.questions', paper.questions.length) }}
          </span>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="form-group">
            <label class="form-label">{{ $t('workspace.paperTitle') }}</label>
            <input v-model="paper.title" class="form-input" :placeholder="$t('workspace.paperTitlePlaceholder')" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">{{ $t('workspace.paperSubject') }}</label>
              <input v-model="paper.subject" class="form-input" :placeholder="$t('workspace.paperSubjectPlaceholder')" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">{{ $t('workspace.duration') }}</label>
              <input v-model.number="paper.duration" type="number" min="1" class="form-input" placeholder="60" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">{{ $t('workspace.totalMarks') }}</label>
              <input v-model.number="paper.totalMarks" type="number" min="1" class="form-input" placeholder="100" />
            </div>
          </div>
          <label v-if="canReadAnswers" class="export-toggle">
            <input v-model="includeAnswersInExport" type="checkbox" />
            <span>{{ $t('workspace.includeAnswers') }}</span>
          </label>
        </div>

        <form class="card generation-card" @submit.prevent="generatePaper">
          <div class="panel-head">
            <div>
              <h2>{{ $t('workspace.autoGenerate') }}</h2>
              <p class="panel-sub">{{ $t('workspace.generateSubtitle') }}</p>
            </div>
            <span v-if="generationDiagnostics" class="tag count-tag">fitness {{ generationDiagnostics.fitness }}</span>
          </div>

          <div class="generation-grid">
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('workspace.numQuestions') }}</label>
              <input v-model.number="generationForm.questionCount" class="form-input" type="number" min="1" max="100" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('difficulty.easy') }}</label>
              <input v-model.number="generationForm.easy" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('difficulty.medium') }}</label>
              <input v-model.number="generationForm.medium" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('difficulty.hard') }}</label>
              <input v-model.number="generationForm.hard" class="form-input" type="number" min="0" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('workspace.population') }}</label>
              <input v-model.number="generationForm.populationSize" class="form-input" type="number" min="20" max="500" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('workspace.generations') }}</label>
              <input v-model.number="generationForm.generations" class="form-input" type="number" min="10" max="1000" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('workspace.crossover') }}</label>
              <input v-model.number="generationForm.crossoverRate" class="form-input" type="number" min="0" max="1" step="0.01" />
            </div>
            <div class="form-group compact-field">
              <label class="form-label">{{ $t('workspace.mutation') }}</label>
              <input v-model.number="generationForm.mutationRate" class="form-input" type="number" min="0" max="1" step="0.01" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">{{ $t('workspace.requiredTags') }}</label>
            <input v-model="generationForm.requiredTags" class="form-input" :placeholder="$t('workspace.requiredTagsPlaceholder')" />
          </div>

          <div class="paper-actions">
            <button class="btn btn-primary" type="submit" :disabled="isGenerating || !paper.title || !paper.subject">
              {{ isGenerating ? $t('workspace.generating') : $t('workspace.generatePaper') }}
            </button>
            <span class="form-hint">{{ $t('workspace.generateHint') }}</span>
          </div>

          <div v-if="generationError" class="status-banner status-banner--error">
            {{ generationError }}
          </div>
          <div v-if="generationDiagnostics" class="generation-summary">
            <span>Difficulty: {{ formatDistribution(generationDiagnostics.difficultyActual) }}</span>
            <span>Types: {{ formatDistribution(generationDiagnostics.typeActual) }}</span>
            <span>{{ $t('workspace.candidates') }}: {{ generationDiagnostics.candidateCount }}</span>
          </div>
        </form>

        <Transition name="fade" mode="out-in">
          <TransitionGroup name="list" tag="div" class="paper-question-list" v-if="paper.questions.length">
            <div v-for="(q, idx) in paper.questions" :key="q.id" class="paper-q-item card">
              <div class="paper-q-controls">
                <button class="icon-btn" :disabled="idx === 0" @click="moveUp(idx)" :title="$t('workspace.moveUp')">{{ $t('workspace.moveUp') }}</button>
                <button class="icon-btn" :disabled="idx === paper.questions.length - 1" @click="moveDown(idx)" :title="$t('workspace.moveDown')">{{ $t('workspace.moveDown') }}</button>
              </div>
              <div class="paper-q-body">
                <div class="paper-q-num">Q{{ idx + 1 }}</div>
                <div class="paper-q-content">
                  <div class="q-meta">
                    <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
                    <span class="tag">{{ q.subject }}</span>
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
              <button class="btn btn-danger btn-sm remove-btn" @click="removeQuestion(q.id)">{{ $t('common.remove') }}</button>
            </div>
          </TransitionGroup>
          <div v-else class="empty-paper card">
            <p>{{ $t('workspace.noQuestionsInPaper') }}</p>
          </div>
        </Transition>

        <div class="paper-actions" style="margin-top:20px">
          <button class="btn btn-success" :disabled="!paper.questions.length || !paper.title" @click="exportPaper">
            {{ $t('workspace.exportPaper') }}
          </button>
          <button class="btn btn-outline" :disabled="!paper.questions.length" @click="clearPaper">
            {{ $t('workspace.clearAll') }}
          </button>
        </div>

        <Transition name="fade">
          <div v-if="exported" class="export-preview card" style="margin-top:24px">
            <div class="export-preview-head">
              <div>
                <h3>{{ paper.title }}</h3>
                <p>
                  {{ $t('workspace.exportSubject') }}: {{ paper.subject || '-' }} |
                  {{ $t('workspace.exportDuration') }}: {{ paper.duration }} {{ $t('workspace.units.min') }} |
                  {{ $t('workspace.exportTotal') }}: {{ paper.totalMarks }} {{ $t('workspace.units.marks') }}
                </p>
              </div>
              <div class="export-mode-actions" aria-label="Export question order">
                <button
                  class="btn btn-sm"
                  :class="exportMode === 'paper' ? 'btn-primary' : 'btn-outline'"
                  @click="exportMode = 'paper'"
                >
                  {{ $t('workspace.paperOrder') }}
                </button>
                <button
                  class="btn btn-sm"
                  :class="exportMode === 'categorized' ? 'btn-primary' : 'btn-outline'"
                  @click="exportMode = 'categorized'"
                >
                  {{ $t('workspace.byType') }}
                </button>
              </div>
            </div>
            <p style="color:var(--color-muted);font-size:.875rem;margin-bottom:16px">
              {{ exportMode === 'categorized' ? $t('workspace.categorizedDesc') : $t('workspace.paperOrderDesc') }}
            </p>
            <section v-for="section in exportSections" :key="section.key" class="export-section">
              <h4 v-if="section.title" class="export-section-title">{{ section.title }}</h4>
              <ol class="export-q-list" :start="section.start">
                <li v-for="q in section.questions" :key="q.id" class="export-question">
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
                    <strong>{{ $t('common.answer') }}:</strong>
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
import { DEFAULT_ESSAY_BLANK_SPACE, type Question } from '~/composables/useQuestionBank'

interface GenerationDiagnostics {
  fitness: number
  candidateCount: number
  difficultyActual: Record<string, number>
  typeActual: Record<string, number>
}

interface GeneratedPaperResponse {
  paper: {
    id: number
    title: string
    subject: string
    duration: number
    totalMarks: number
    questions: Question[]
  }
  diagnostics: GenerationDiagnostics
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
const { apiFetch } = useApi()
const { t } = useI18n()

type ExportMode = 'paper' | 'categorized'
type QuestionType = Question['type']
type BankMode = 'all' | 'mine'

const search = ref('')
const filterSubject = ref('')
const filterDifficulty = ref('')
const shown = ref<Set<number>>(new Set())
const exportMode = ref<ExportMode>('paper')
const includeAnswersInExport = ref(false)
const bankMode = ref<BankMode>('all')
const pageSize = ref(20)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)

const paper = reactive({
  title: '',
  subject: '',
  duration: 60,
  totalMarks: 100,
  questions: [] as Question[]
})

const exported = ref(false)
const questionTypeOrder: QuestionType[] = ['choice', 'true_false', 'blank', 'short_answer', 'essay']

const canReadQuestions = computed(() => hasPermission('questions:read'))

const generationForm = reactive({
  questionCount: 5,
  easy: 2,
  medium: 2,
  hard: 1,
  populationSize: 80,
  generations: 120,
  crossoverRate: 0.85,
  mutationRate: 0.08,
  requiredTags: ''
})

const currentQuestions = computed(() => bankMode.value === 'mine' ? myQuestions.value : questions.value)
const activePagination = computed(() => bankMode.value === 'mine' ? myQuestionPagination.value : questionPagination.value)
const activeLoading = computed(() => bankMode.value === 'mine' ? isLoadingMine.value : isLoading.value)

watch(
  [isAuthReady, canReadQuestions],
  ([ready, allowed]) => {
    if (ready && allowed) void loadCurrentPage(1)
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
  return t(`questionTypes.${type}`) || type
}

const subjects = computed(() => [...new Set(currentQuestions.value.map(question => question.subject))].sort())

const exportSections = computed(() => {
  const rawSections = exportMode.value === 'categorized'
    ? questionTypeOrder.map(type => ({
        key: type,
        title: t(`questionTypes.${type}`),
        questions: paper.questions.filter(question => question.type === type)
      })).filter(section => section.questions.length)
    : [{
        key: 'paper',
        title: '',
        questions: paper.questions
      }]

  let start = 1
  return rawSections.map((section) => {
    const currentStart = start
    start += section.questions.length
    return {
      ...section,
      start: currentStart
    }
  })
})

function isAdded (id: number) {
  return paper.questions.some(question => question.id === id)
}

function toggleQuestion (question: Question) {
  if (isAdded(question.id)) {
    removeQuestion(question.id)
    return
  }

  paper.questions = [...paper.questions, question]
}

function removeQuestion (id: number) {
  paper.questions = paper.questions.filter(question => question.id !== id)
}

function moveUp (idx: number) {
  if (idx === 0) return
  const next = [...paper.questions]
  const previous = next[idx - 1]
  const current = next[idx]
  if (!previous || !current) return
  next[idx - 1] = current
  next[idx] = previous
  paper.questions = next
}

function moveDown (idx: number) {
  if (idx >= paper.questions.length - 1) return
  const next = [...paper.questions]
  const current = next[idx]
  const following = next[idx + 1]
  if (!current || !following) return
  next[idx] = following
  next[idx + 1] = current
  paper.questions = next
}

function clearPaper () {
  paper.questions = []
  exported.value = false
  exportMode.value = 'paper'
}

function exportPaper () {
  exported.value = true
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
        questionCount: generationForm.questionCount,
        difficultyTargets: {
          easy: generationForm.easy,
          medium: generationForm.medium,
          hard: generationForm.hard
        },
        requiredTags: generationForm.requiredTags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
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
    generationDiagnostics.value = response.data.diagnostics
    exported.value = false
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

function toggleAnswer (id: number) {
  const next = new Set(shown.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  shown.value = next
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

