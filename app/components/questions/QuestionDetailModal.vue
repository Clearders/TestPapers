<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-panel" role="dialog" aria-modal="true" :aria-label="`Question #${question.id} details`">
      <div class="modal-head">
        <div>
          <h2>Question #{{ question.id }}</h2>
          <p>{{ typeLabel }} | {{ question.difficulty }} | weight {{ formatScoreWeight(question.scoreWeight) }}</p>
        </div>
        <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="detail-meta">
          <span v-for="subject in question.subjects" :key="subject" class="subject-pill">{{ subject }}</span>
          <span v-for="tag in question.tags" :key="tag" class="tag">{{ tag }}</span>
          <span v-if="question.hasLatex" class="tag">LaTeX</span>
          <span v-if="question.source" class="tag">Source: {{ question.source }}</span>
        </div>

        <section class="detail-section">
          <h3>Prompt</h3>
          <p class="detail-text">
            <template v-for="(part, index) in parseLatexParts(question.text)" :key="index">
              <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
              <span v-else>{{ part.content }}</span>
            </template>
          </p>
        </section>

        <section v-if="isOptionQuestionType(question.type) && question.options?.length" class="detail-section">
          <h3>Options</h3>
          <div class="detail-options">
            <div v-for="(option, index) in question.options" :key="index" class="detail-option">
              <strong>{{ String.fromCharCode(65 + index) }}.</strong>
              <span>
                <template v-for="(part, partIndex) in parseLatexParts(option)" :key="partIndex">
                  <LatexRenderer v-if="part.isLatex" :formula="part.content" />
                  <span v-else>{{ part.content }}</span>
                </template>
              </span>
            </div>
          </div>
        </section>

        <section v-if="question.images?.length" class="detail-section">
          <h3>Images</h3>
          <div class="detail-images">
            <img
              v-for="(image, index) in question.images"
              :key="index"
              :src="image.url"
              :alt="image.caption || 'Question image'"
              :title="image.caption || ''"
              class="detail-image"
            >
          </div>
        </section>

        <section v-if="canReadAnswers" class="detail-section detail-answer">
          <h3>Answer</h3>
          <p>
            <template v-if="Array.isArray(question.answer)">
              {{ question.answer.join(', ') }}
            </template>
            <template v-for="(part, index) in parseLatexParts(question.answer)" v-else :key="index">
              <LatexRenderer v-if="part.isLatex" :formula="part.content" />
              <span v-else>{{ part.content }}</span>
            </template>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Question } from '~/types/question'
import { QUESTION_TYPE_LABELS, isOptionQuestionType } from '~/domain/questions'
import { parseLatexParts } from '~/composables/useLatexParts'
import { formatScoreWeight } from '~/utils/format'

const props = defineProps<{
  question: Question
  canReadAnswers: boolean
}>()

defineEmits<{
  close: []
}>()

const typeLabel = computed(() => QUESTION_TYPE_LABELS[props.question.type] || props.question.type)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 135;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 12, 28, 0.48);
  backdrop-filter: blur(8px);
}

.modal-panel {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--color-border);
}

.modal-head h2 {
  font-size: 1.08rem;
}

.modal-head p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .86rem;
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

.modal-body {
  padding: 18px 20px 20px;
}

.detail-meta,
.detail-options,
.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-section {
  margin-top: 18px;
}

.detail-section h3 {
  margin-bottom: 8px;
  font-size: .82rem;
  color: var(--color-muted);
  text-transform: uppercase;
}

.detail-text,
.detail-section p {
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.detail-option {
  flex: 1 1 240px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.detail-option strong {
  color: var(--color-primary);
}

.detail-image {
  max-width: 220px;
  max-height: 160px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-solid);
}

.detail-answer {
  padding: 14px;
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius);
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.subject-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: .75rem;
  font-weight: 500;
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
}

:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
