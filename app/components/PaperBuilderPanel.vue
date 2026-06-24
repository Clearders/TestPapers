<template>
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
        <input id="paper-title" v-model="paperTitleModel" class="form-input" name="paperTitle" placeholder="e.g. Mid-term Examination 2026..." >
      </div>
      <div class="paper-meta-row">
        <div class="form-group paper-meta-field">
          <label class="form-label" for="paper-subject">Subject</label>
          <input id="paper-subject" v-model="paperSubjectModel" class="form-input" name="paperSubject" placeholder="e.g. Mathematics..." >
        </div>
        <div class="form-group paper-meta-field">
          <label class="form-label" for="paper-duration">Duration (min)</label>
          <input id="paper-duration" v-model.number="paperDurationModel" type="number" min="1" class="form-input" name="paperDuration" placeholder="60..." >
        </div>
      </div>
      <label v-if="canReadAnswers" class="export-toggle">
        <input v-model="includeAnswersModel" type="checkbox" >
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
      @update:generation-form="(e) => emit('update:generation-form', e)"
      @update:total-marks="(v) => emit('update:total-marks', v)"
      @generate="() => emit('generate')"
    />

    <Transition name="fade" mode="out-in">
      <TransitionGroup v-if="paper.questions.length" name="list" tag="div" class="paper-question-list">
        <div v-for="(q, idx) in paper.questions" :key="q.id" class="paper-q-item card">
          <div class="paper-q-controls">
            <button class="icon-btn" :disabled="idx === 0" aria-label="Move question up" @click="emit('move-up', idx)"><AppIcon name="arrow-up" /></button>
            <button class="icon-btn" :disabled="idx === paper.questions.length - 1" aria-label="Move question down" @click="emit('move-down', idx)"><AppIcon name="arrow-down" /></button>
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
                <template v-for="(part, i) in paperQuestionLatexParts.get(q.id) || []" :key="i">
                  <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                  <span v-else>{{ part.content }}</span>
                </template>
              </div>
            </div>
          </div>
          <button class="btn btn-danger btn-sm remove-btn" @click="emit('remove-question', q.id)">
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
      <button class="btn btn-success" :disabled="!paper.questions.length || !paper.title.trim()" @click="emit('export-paper')">
        <AppIcon name="paper" />
        Export Paper
      </button>
      <button class="btn btn-primary" :disabled="!canDownloadDocx" @click="emit('download-docx')">
        <AppIcon name="download" />
        {{ isDownloadingDocx ? 'Preparing DOCX...' : 'Download DOCX' }}
      </button>
      <button class="btn btn-outline" :disabled="!paper.questions.length" @click="emit('clear-paper')">
        <AppIcon name="x" />
        Clear All
      </button>
    </div>

    <div v-if="downloadError" class="status-banner status-banner--error download-error" aria-live="polite">
      {{ downloadError }}
    </div>

    <PaperExportPanel
      v-model:export-mode="exportModeModel"
      v-model:layout-density="layoutDensityModel"
      v-model:include-answers-in-export="includeAnswersModel"
      :visible="exported"
      :paper-title="paper.title"
      :paper-subject="paper.subject"
      :paper-duration="paper.duration"
      :paper-total-marks="paper.totalMarks"
      :paper-questions="paper.questions"
      :can-read-answers="canReadAnswers"
      :downloaded-layout-density="downloadedLayoutDensity"
    />
  </div>
</template>

<script setup lang="ts">
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { GenerationFormState, PaperState } from '~/domain/papers'
import { formatScoreWeight } from '~/utils/format'
import { parseLatexParts } from '~/composables/useLatexParts'

const props = defineProps<{
  paper: PaperState
  generationForm: GenerationFormState
  exportMode: ExportMode
  layoutDensity: LayoutDensity
  includeAnswersInExport: boolean
  canReadAnswers: boolean
  canWritePapers: boolean
  isGenerating: boolean
  generationError: string
  generationDiagnostics: GenerationDiagnostics | null
  availableSubjects: string[]
  availableTags: string[]
  isLoadingMeta: boolean
  exported: boolean
  isDownloadingDocx: boolean
  downloadError: string
  downloadedLayoutDensity: LayoutDensity | null
  canDownloadDocx: boolean
}>()

const emit = defineEmits<{
  'update:paper-title': [value: string]
  'update:paper-subject': [value: string]
  'update:paper-duration': [value: number]
  'update:generation-form': [value: Partial<GenerationFormState>]
  'update:total-marks': [value: number]
  'update:exportMode': [value: ExportMode]
  'update:layoutDensity': [value: LayoutDensity]
  'update:includeAnswersInExport': [value: boolean]
  'generate': []
  'move-up': [index: number]
  'move-down': [index: number]
  'remove-question': [id: number]
  'export-paper': []
  'download-docx': []
  'clear-paper': []
}>();

const paperTitleModel = computed({
  get: () => props.paper.title,
  set: (v: string) => emit('update:paper-title', v)
})
const paperSubjectModel = computed({
  get: () => props.paper.subject,
  set: (v: string) => emit('update:paper-subject', v)
})
const paperDurationModel = computed({
  get: () => props.paper.duration,
  set: (v: number) => emit('update:paper-duration', v)
})
const exportModeModel = computed({
  get: () => props.exportMode,
  set: (v: ExportMode) => emit('update:exportMode', v)
})
const layoutDensityModel = computed({
  get: () => props.layoutDensity,
  set: (v: LayoutDensity) => emit('update:layoutDensity', v)
})
const includeAnswersModel = computed({
  get: () => props.includeAnswersInExport,
  set: (v: boolean) => emit('update:includeAnswersInExport', v)
})

const paperQuestionLatexParts = computed(() => {
  const map = new Map<number, ReturnType<typeof parseLatexParts>>()
  for (const q of props.paper.questions) map.set(q.id, parseLatexParts(q.text))
  return map
})
</script>
