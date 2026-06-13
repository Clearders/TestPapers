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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Question, QuestionType } from '~/types/question'
import type { ExportMode } from '~/types/generation'
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
  includeAnswersInExport: boolean
  canReadAnswers: boolean
}>()

const emit = defineEmits<{
  'update:exportMode': [value: ExportMode]
  'update:includeAnswersInExport': [value: boolean]
}>()

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
