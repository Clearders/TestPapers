<template>
  <Transition name="fade">
    <div v-if="visible" class="export-preview card">
      <div class="export-preview-head">
        <div>
          <h3>{{ paperTitle }}</h3>
          <p>
            Subject: {{ paperSubject || '-' }} |
            Duration: {{ paperDuration }} min |
            Total: {{ paperTotalMarks }} marks
          </p>
        </div>
        <div class="export-mode-actions" aria-label="Export question order">
          <button
            class="btn btn-sm"
            :class="exportMode === 'paper' ? 'btn-primary' : 'btn-outline'"
            @click="$emit('update:exportMode', 'paper')"
          >
            Paper Order
          </button>
          <button
            class="btn btn-sm"
            :class="exportMode === 'categorized' ? 'btn-primary' : 'btn-outline'"
            @click="$emit('update:exportMode', 'categorized')"
          >
            By Type
          </button>
        </div>
        <div class="export-density-actions" aria-label="DOCX layout density">
          <button
            v-for="density in layoutDensityOptions"
            :key="density.value"
            class="btn btn-sm"
            :class="layoutDensity === density.value ? 'btn-primary' : 'btn-outline'"
            @click="$emit('update:layoutDensity', density.value)"
          >
            {{ density.label }}
          </button>
        </div>
      </div>
      <p class="export-preview-note">
        {{ exportSummary }}
      </p>
      <p v-if="downloadedLayoutDensitySummary" class="export-preview-note export-preview-note--success" aria-live="polite">
        {{ downloadedLayoutDensitySummary }}
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
                decoding="async"
              >
            </div>

            <div v-if="includeAnswersInExport && canReadAnswers" class="export-answer">
              <strong>Answer:</strong>
              <template v-if="Array.isArray(q.answer)">
                {{ q.answer.join(', ') }}
              </template>
              <template v-for="(part, i) in parseLatexParts(q.answer)" v-else :key="i">
                <LatexRenderer v-if="part.isLatex" :formula="part.content" />
                <span v-else>{{ part.content }}</span>
              </template>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Question, QuestionType } from '~/types/question'
import type { ExportMode, LayoutDensity } from '~/types/generation'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ORDER,
  getEssayBlankHeightPx,
  isOptionQuestionType
} from '~/domain/questions'

type PaperQuestion = Question & { marks?: number; orderNo?: number }

const props = defineProps<{
  visible: boolean
  paperTitle: string
  paperSubject: string
  paperDuration: number
  paperTotalMarks: number
  paperQuestions: PaperQuestion[]
  exportMode: ExportMode
  layoutDensity: LayoutDensity
  includeAnswersInExport: boolean
  canReadAnswers: boolean
  downloadedLayoutDensity: LayoutDensity | null
}>()

defineEmits<{
  'update:exportMode': [value: ExportMode]
  'update:layoutDensity': [value: LayoutDensity]
  'update:includeAnswersInExport': [value: boolean]
}>()

const layoutDensityOptions: { value: LayoutDensity; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'dense', label: 'Dense' }
]

function layoutDensityLabel (value: LayoutDensity) {
  return layoutDensityOptions.find(option => option.value === value)?.label || 'Auto'
}

const exportSummary = computed(() => {
  const orderText = props.exportMode === 'categorized'
    ? 'Questions are grouped as multiple-choice, fill-in-the-blank, and essay, with forward numbering across sections.'
    : 'Questions follow the order from the paper builder.'
  const densityLabel = layoutDensityLabel(props.layoutDensity)
  return `${orderText} DOCX layout: ${densityLabel}.`
})

const downloadedLayoutDensitySummary = computed(() => {
  if (!props.downloadedLayoutDensity) return ''

  const effectiveLabel = layoutDensityLabel(props.downloadedLayoutDensity)
  if (props.layoutDensity === 'auto') {
    return `Downloaded DOCX used ${effectiveLabel} layout from Auto.`
  }
  return `Downloaded DOCX used ${effectiveLabel} layout.`
})

function getEssayBlankStyle (question: Question) {
  return {
    minHeight: `${getEssayBlankHeightPx(question.essayBlankSpace)}px`
  }
}

const exportSections = computed(() => {
  if (props.exportMode !== 'categorized') {
    return [{ key: 'paper', title: '', questions: props.paperQuestions, start: 1 }]
  }

  const byType = new Map<QuestionType, PaperQuestion[]>()
  for (const q of props.paperQuestions) {
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
</script>

<style scoped>
.export-preview {
  background: var(--color-surface);
  margin-top: 24px;
  overflow: hidden;
  animation: exportIn .46s cubic-bezier(0.16, 1, 0.3, 1) both;
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
.export-preview-note--success {
  color: #166534;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 12px;
}
.export-mode-actions,
.export-density-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.export-section {
  margin-top: 18px;
  animation: revealUp .36s cubic-bezier(0.16, 1, 0.3, 1) both;
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
  animation: revealUp .28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.export-q-list li:nth-child(2n) { animation-delay: .04s; }
.export-q-list li:nth-child(3n) { animation-delay: .08s; }
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
  animation: revealUp .24s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.export-image-thumb {
  max-width: 160px;
  max-height: 120px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}
.export-image-thumb:hover {
  transform: translateY(-2px) scale(1.02);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-soft);
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
@media (max-width: 700px) {
  .export-preview-head,
  .export-mode-actions,
  .export-density-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
@media (max-width: 560px) {
  .export-mode-actions .btn,
  .export-density-actions .btn {
    width: 100%;
  }

  .export-image-thumb {
    max-width: 100%;
    width: 100%;
  }
}

.q-option-label {
  font-weight: 700;
  color: var(--color-primary);
}

[data-theme="dark"] .export-answer {
  background: rgba(30, 41, 59, 0.5);
}
[data-theme="dark"] .export-preview-note--success {
  color: #bbf7d0;
  background: rgba(22, 101, 52, 0.26);
  border-color: rgba(134, 239, 172, 0.28);
}
@keyframes exportIn {
  from { opacity: 0; transform: translateY(18px) scale(.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
