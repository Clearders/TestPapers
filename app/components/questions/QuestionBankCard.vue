<template>
  <div class="q-card card" :style="{ animationDelay: `${index * 0.05}s` }">
    <div class="q-card-header">
      <div class="q-meta">
        <span class="badge" :class="`badge-${question.difficulty}`">{{ question.difficulty }}</span>
        <span v-for="sub in question.subjects" :key="sub" class="subject-pill">{{ sub }}</span>
        <span class="tag">weight {{ formatScoreWeight(question.scoreWeight) }}</span>
        <span v-for="tag in question.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <span class="q-id">#{{ question.id }}</span>
    </div>

    <div class="q-body">
      <div class="q-text">
        <span class="q-type-tag">{{ typeLabel(question.type) }}</span>
        <template v-for="(part, i) in parseLatexParts(question.text)" :key="i">
          <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
          <span v-else>{{ part.content }}</span>
        </template>
      </div>

      <div v-if="isOptionQuestionType(question.type) && question.options?.length" class="q-options">
        <div v-for="(opt, idx) in question.options" :key="idx" class="q-option">
          <span class="q-option-label">{{ String.fromCharCode(65 + idx) }}.</span>
          <template v-for="(part, i) in parseLatexParts(opt)" :key="i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" />
            <span v-else>{{ part.content }}</span>
          </template>
        </div>
      </div>

      <div v-if="question.images?.length" class="q-images">
        <img
          v-for="(img, imgIdx) in question.images"
          :key="imgIdx"
          :src="img.url"
          :alt="img.caption || 'Question image'"
          :title="img.caption || ''"
          width="160"
          height="120"
          class="q-image-thumb"
        />
      </div>

      <p v-if="question.source" class="q-source">Source: {{ question.source }}</p>
    </div>

    <div class="q-footer">
      <button v-if="canReadAnswers" class="btn btn-outline btn-sm" @click="$emit('toggle-answer', question.id)">
        {{ isShown ? 'Hide Answer' : 'Show Answer' }}
      </button>
      <button
        class="btn btn-sm"
        :class="isAdded ? 'btn-danger' : 'btn-primary'"
        @click="$emit('toggle-question', question)"
      >
        {{ isAdded ? 'Remove from Paper' : 'Add to Paper' }}
      </button>
    </div>

    <div class="q-answer-wrapper" :class="{ 'is-open': isShown }">
      <div class="q-answer-inner">
        <div v-if="canReadAnswers" class="q-answer">
          <strong>Answer:</strong>
          <template v-if="Array.isArray(question.answer)">
            {{ question.answer.join(', ') }}
          </template>
          <template v-else v-for="(part, i) in parseLatexParts(question.answer)" :key="i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" />
            <span v-else>{{ part.content }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Question } from '~/types/question'
import { isOptionQuestionType } from '~/domain/questions'

defineProps<{
  question: Question
  index: number
  canReadAnswers: boolean
  isShown: boolean
  isAdded: boolean
  typeLabel: (type: Question['type']) => string
}>()

import { formatScoreWeight } from '~/utils/format'

defineEmits<{
  'toggle-answer': [id: number]
  'toggle-question': [question: Question]
}>()
</script>

<style scoped>
.q-card {
  min-width: 0;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}
.q-card:hover {
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
.subject-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
}
.q-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.q-text {
  font-size: .95rem;
  line-height: 1.7;
  min-width: 0;
  overflow-wrap: anywhere;
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
  min-width: 0;
  overflow-wrap: anywhere;
}
.q-option-label {
  font-weight: 700;
  color: var(--color-primary);
}
.q-source {
  font-size: .82rem;
  color: var(--color-muted);
}
.q-footer {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
.q-image-thumb {
  max-width: 160px;
  max-height: 120px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
@media (max-width: 560px) {
  .q-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .q-footer .btn,
  .q-image-thumb {
    width: 100%;
  }

  .q-image-thumb {
    max-width: 100%;
  }
}
</style>
