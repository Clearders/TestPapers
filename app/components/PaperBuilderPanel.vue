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
      :meta-error="metaError"
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
                <span v-if="q.isTemporaryEdit" class="tag temp-edit-tag">
                  <AppIcon name="edit" />
                  draft edit
                </span>
              </div>
              <div class="q-text-wrap">
                <template v-for="(part, i) in paperQuestionLatexParts.get(q.id) || []" :key="i">
                  <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                  <span v-else>{{ part.content }}</span>
                </template>
              </div>
            </div>
          </div>
          <div class="paper-q-actions">
            <button class="btn btn-outline btn-sm" @click="emit('edit-temporary-question', q)">
              <AppIcon name="edit" />
              Edit Draft
            </button>
            <button v-if="q.isTemporaryEdit" class="btn btn-outline btn-sm" @click="emit('reset-temporary-question', q.id)">
              <AppIcon name="x" />
              Reset
            </button>
            <button class="btn btn-danger btn-sm remove-btn" @click="emit('remove-question', q.id)">
              <AppIcon name="trash" />
              Remove
            </button>
          </div>
        </div>
      </TransitionGroup>
      <div v-else class="empty-paper card">
        <p>No questions added yet. Add them from the bank on the left.</p>
      </div>
    </Transition>

    <div class="paper-actions paper-actions--export">
      <button class="btn btn-outline" :disabled="!canSavePaper" @click="emit('save-paper')">
        <AppIcon name="check" />
        {{ isSavingPaper ? 'Saving...' : 'Save Paper' }}
      </button>
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
    <div v-if="saveError" class="status-banner status-banner--error download-error" aria-live="polite">
      {{ saveError }}
    </div>
    <div v-if="saveSuccess" class="status-banner status-banner--success download-error" aria-live="polite">
      Paper saved.
    </div>

    <PaperExportPanel
      v-if="showInlineExportPreview !== false"
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
    <Transition name="modal">
      <div v-if="exportAccessPrompt" class="modal-overlay export-access-overlay" @click.self="emit('dismiss-export-access-prompt')">
        <div class="modal-panel export-access-panel" role="dialog" aria-modal="true" :aria-label="exportAccessPrompt.title">
          <div class="modal-head">
            <h2>{{ exportAccessPrompt.title }}</h2>
            <button class="modal-close" type="button" aria-label="Close" @click="emit('dismiss-export-access-prompt')">&times;</button>
          </div>
          <div class="modal-body export-access-body">
            <p>{{ exportAccessPrompt.message }}</p>
            <div class="export-access-actions">
              <template v-if="exportAccessPrompt.kind === 'account'">
                <NuxtLink to="/register" class="btn btn-primary" @click="emit('dismiss-export-access-prompt')">
                  <AppIcon name="account" />
                  Create Account
                </NuxtLink>
                <NuxtLink to="/login" class="btn btn-outline" @click="emit('dismiss-export-access-prompt')">
                  <AppIcon name="login" />
                  Login
                </NuxtLink>
              </template>
              <button v-else type="button" class="btn btn-primary" @click="emit('dismiss-export-access-prompt')">
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { ExportAccessPrompt } from '~/composables/usePaperExport'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { GenerationFormState, PaperQuestion, PaperState } from '~/domain/papers'
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
  metaError: string
  exported: boolean
  isDownloadingDocx: boolean
  downloadError: string
  isSavingPaper?: boolean
  saveError?: string
  saveSuccess?: boolean
  downloadedLayoutDensity: LayoutDensity | null
  canDownloadDocx: boolean
  exportAccessPrompt: ExportAccessPrompt
  showInlineExportPreview?: boolean
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
  'edit-temporary-question': [question: PaperQuestion]
  'reset-temporary-question': [id: number]
  'save-paper': []
  'export-paper': []
  'download-docx': []
  'clear-paper': []
  'dismiss-export-access-prompt': []
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

const canSavePaper = computed(() => {
  if (props.isSavingPaper) return false
  return Boolean(props.paper.questions.length && props.paper.title.trim() && props.paper.subject.trim())
})

const paperQuestionLatexParts = computed(() => {
  const map = new Map<number, ReturnType<typeof parseLatexParts>>()
  for (const q of props.paper.questions) map.set(q.id, parseLatexParts(q.text))
  return map
})
</script>

<style scoped>
.paper-panel {
  min-width: 0;
  animation: revealUp 0.56s var(--ease-out) 0.16s both;
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
.tag-count {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-solid));
  color: var(--color-primary-d);
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
.paper-meta-row,
.export-toggle {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.paper-meta-field {
  flex: 1;
  min-width: 150px;
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
  border-radius: var(--radius-sm);
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
.subject-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: .75rem;
  font-weight: 500;
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
  transition: transform .18s ease, background .18s ease;
}
.subject-pill:hover {
  transform: translateY(-1px);
  background: rgba(118, 87, 255, 0.16);
}
.paper-q-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.remove-btn {
  white-space: nowrap;
}
.temp-edit-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-color: rgba(14, 165, 233, 0.28);
  background: rgba(14, 165, 233, 0.08);
  color: var(--color-primary-d);
}
.empty-paper {
  text-align: center;
  color: var(--color-muted);
}
.paper-actions,
.paper-meta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.paper-actions--export {
  margin-top: 20px;
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
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 12, 28, 0.46);
  backdrop-filter: blur(8px);
}
.modal-panel {
  width: min(460px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--color-border);
}
.modal-head h2 {
  font-size: 1.08rem;
}
.modal-close {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
  font-size: 1.2rem;
}
.modal-close:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
}
.modal-body {
  padding: 18px 20px 20px;
}
.export-access-body p {
  color: var(--color-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}
.export-access-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
  .paper-q-actions,
  .remove-btn {
    width: 100%;
  }
  .paper-q-actions {
    justify-content: stretch;
  }
  .paper-q-actions .btn {
    flex: 1 1 100%;
  }
  .paper-q-num {
    min-width: 24px;
  }
}
@media (max-width: 560px) {
  .paper-actions .btn {
    width: 100%;
  }
  .paper-meta-field {
    min-width: 100%;
  }
}
@keyframes sideBarGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
</style>
