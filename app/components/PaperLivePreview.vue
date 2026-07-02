<template>
  <aside class="live-preview" :class="{ 'live-preview--fullscreen': fullscreen }">
    <div class="live-preview-head">
      <div>
        <h2><AppIcon name="eye" /> Live Preview</h2>
        <p>{{ previewSummary }}</p>
      </div>
      <div class="live-preview-actions">
        <button
          v-if="commentsEnabled"
          class="icon-btn comment-btn"
          type="button"
          aria-label="Open draft comments"
          :title="`${openCommentCount} open comments, ${commentCount} total`"
          @click="$emit('toggle-comments')"
        >
          <AppIcon name="edit" />
          <span v-if="openCommentCount" class="comment-count">{{ openCommentCount }}</span>
        </button>
        <button class="icon-btn" type="button" aria-label="Print paper" title="Print paper" @click="$emit('print-paper')">
          <AppIcon name="printer" />
        </button>
        <button
          class="icon-btn"
          type="button"
          :aria-label="fullscreen ? 'Exit fullscreen preview' : 'Open fullscreen preview'"
          :title="fullscreen ? 'Exit fullscreen preview' : 'Open fullscreen preview'"
          @click="$emit('toggle-fullscreen')"
        >
          <AppIcon :name="fullscreen ? 'x' : 'maximize'" />
        </button>
      </div>
    </div>

    <div class="preview-scroll">
      <PaperExportPanel
        v-model:export-mode="exportModeModel"
        v-model:layout-density="layoutDensityModel"
        v-model:include-answers-in-export="includeAnswersModel"
        :visible="true"
        :paper-title="paperState.title || 'Untitled Paper'"
        :paper-subject="paperState.subject"
        :paper-duration="paperState.duration"
        :paper-total-marks="paperState.totalMarks"
        :paper-questions="paperQuestions"
        :can-read-answers="canReadAnswers"
        :downloaded-layout-density="downloadedLayoutDensity"
      />
      <div v-if="!paperQuestions.length" class="empty-preview card">
        <span class="empty-preview-icon"><AppIcon name="paper" /></span>
        <p>No questions added yet.</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ExportMode, LayoutDensity } from '~/types/generation'
import type { PaperState } from '~/domain/papers'
import { createDefaultPaper } from '~/domain/papers'

const props = withDefaults(defineProps<{
  paper: PaperState
  exportMode: ExportMode
  layoutDensity: LayoutDensity
  includeAnswersInExport: boolean
  canReadAnswers: boolean
  downloadedLayoutDensity: LayoutDensity | null
  fullscreen: boolean
  commentsEnabled?: boolean
  commentCount?: number
  openCommentCount?: number
}>(), {
  commentsEnabled: false,
  commentCount: 0,
  openCommentCount: 0
})

const emit = defineEmits<{
  'update:exportMode': [value: ExportMode]
  'update:layoutDensity': [value: LayoutDensity]
  'update:includeAnswersInExport': [value: boolean]
  'toggle-fullscreen': []
  'print-paper': []
  'toggle-comments': []
}>()

const paperState = computed(() => ({
  ...createDefaultPaper(),
  ...(props.paper || {}),
  questions: Array.isArray(props.paper?.questions) ? props.paper.questions : []
}))
const paperQuestions = computed(() => paperState.value.questions)

const exportModeModel = computed({
  get: () => props.exportMode,
  set: (value: ExportMode) => emit('update:exportMode', value)
})

const layoutDensityModel = computed({
  get: () => props.layoutDensity,
  set: (value: LayoutDensity) => emit('update:layoutDensity', value)
})

const includeAnswersModel = computed({
  get: () => props.includeAnswersInExport,
  set: (value: boolean) => emit('update:includeAnswersInExport', value)
})

const previewSummary = computed(() => {
  const questionCount = paperQuestions.value.length
  const marks = paperState.value.totalMarks || 0
  return `${questionCount} question${questionCount === 1 ? '' : 's'} | ${marks} marks`
})

</script>

<style scoped>
.live-preview {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
  position: sticky;
  top: calc(var(--header-h) + 14px);
  max-height: calc(100vh - var(--header-h) - 28px);
  display: flex;
  flex-direction: column;
  animation: revealRight .56s var(--ease-out) .08s both;
}

.live-preview--fullscreen {
  position: fixed;
  inset: 18px;
  z-index: 150;
  max-height: none;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow);
}

.live-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--color-border);
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
}

.live-preview-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 850;
}

.live-preview-head p {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 3px;
}

.live-preview-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
  transition: transform .2s var(--ease-spring), color .2s ease, border-color .2s ease, box-shadow .2s ease;
}

.icon-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.comment-btn {
  position: relative;
}

.comment-count {
  position: absolute;
  top: -7px;
  right: -7px;
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  color: #fff;
  font-size: .68rem;
  font-weight: 800;
}

.preview-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px;
}

:deep(.export-preview) {
  margin-top: 0;
}

.empty-preview {
  margin-top: 16px;
  text-align: center;
  color: var(--color-muted);
}

.empty-preview-icon {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-bottom: 10px;
  border-radius: var(--radius);
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
}

@media (max-width: 1080px) {
  .live-preview {
    position: relative;
    top: auto;
    max-height: none;
  }
}

@media print {
  .live-preview {
    position: static;
    max-height: none;
    border: none;
    box-shadow: none;
  }

  .live-preview-head,
  .empty-preview {
    display: none;
  }

  .preview-scroll {
    overflow: visible;
    padding: 0;
  }
}
</style>
