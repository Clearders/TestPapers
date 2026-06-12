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
          loading="lazy"
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
      <button
        v-if="canEdit"
        class="btn btn-outline btn-sm"
        @click="$emit('edit', question)"
      >
        Edit
      </button>
      <button
        class="btn btn-outline btn-sm correction-report-btn"
        @click="$emit('report', question)"
      >
        Report Issue
        <span v-if="openCorrectionCount" class="correction-badge">{{ openCorrectionCount }}</span>
      </button>
    </div>

    <QuestionRevisionHistory v-if="canReview" :question-id="question.id" />

    <div v-if="canReview" class="correction-panel">
      <button class="correction-toggle" type="button" @click="toggleCorrections">
        <span>{{ correctionsOpen ? 'Hide Corrections' : 'Corrections' }}</span>
        <span v-if="!correctionsOpen && corrections.length" class="revision-count">{{ corrections.length }}</span>
      </button>
      <div v-if="correctionsOpen" class="correction-list">
        <div v-if="correctionsLoading" class="correction-status-text">Loading…</div>
        <div v-else-if="!corrections.length" class="correction-status-text">No corrections yet.</div>
        <div
          v-for="corr in corrections"
          :key="corr.id"
          class="correction-item"
          :class="'corr-item--' + corr.status"
        >
          <div class="correction-item-head">
            <span class="correction-item-category" :class="'corr-cat--' + corr.category">{{ formatCategory(corr.category) }}</span>
            <span class="correction-item-status" :class="'corr-status--' + corr.status">{{ formatStatus(corr.status) }}</span>
          </div>
          <p class="correction-item-msg">{{ corr.message }}</p>
          <div v-if="canEdit && corr.status === 'open'" class="correction-item-actions">
            <button class="btn btn-sm btn-success" type="button" @click.stop="handleAccept(corr.id)">Accept</button>
            <button class="btn btn-sm btn-danger" type="button" @click.stop="handleReject(corr.id)">Reject</button>
          </div>
        </div>
      </div>
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
import type { Question, QuestionCorrection } from '~/types/question'
import { isOptionQuestionType } from '~/domain/questions'
import QuestionRevisionHistory from '~/components/questions/QuestionRevisionHistory.vue'

const props = defineProps<{
  question: Question
  index: number
  canReadAnswers: boolean
  isShown: boolean
  isAdded: boolean
  typeLabel: (type: Question['type']) => string
  canEdit: boolean
  canReview: boolean
}>()

import { formatScoreWeight } from '~/utils/format'

defineEmits<{
  'toggle-answer': [id: number]
  'toggle-question': [question: Question]
  edit: [question: Question]
  report: [question: Question]
}>()

const { fetchCorrections, updateCorrectionStatus } = useQuestionBank()
const correctionsOpen = ref(false)
const corrections = ref<QuestionCorrection[]>([])
const correctionsLoading = ref(false)

const openCorrectionCount = computed(() => corrections.value.filter(c => c.status === 'open').length)

onMounted(() => {
  void loadCorrections()
})

async function toggleCorrections () {
  correctionsOpen.value = !correctionsOpen.value
  if (correctionsOpen.value && !corrections.value.length) {
    await loadCorrections()
  }
}

async function loadCorrections () {
  correctionsLoading.value = true
  try {
    corrections.value = await fetchCorrections(props.question.id)
  } catch {
    corrections.value = []
  } finally {
    correctionsLoading.value = false
  }
}

async function handleAccept (correctionId: number) {
  try {
    await updateCorrectionStatus(props.question.id, correctionId, 'accepted')
    await loadCorrections()
  } catch { /* ignore */ }
}

async function handleReject (correctionId: number) {
  try {
    await updateCorrectionStatus(props.question.id, correctionId, 'rejected')
    await loadCorrections()
  } catch { /* ignore */ }
}

function formatCategory (cat: string) {
  const labels: Record<string, string> = {
    wrong_answer: 'Wrong Answer',
    unclear: 'Unclear',
    typo: 'Typo',
    other: 'Other'
  }
  return labels[cat] || cat
}

function formatStatus (status: string) {
  const labels: Record<string, string> = {
    open: 'Open',
    accepted: 'Accepted',
    rejected: 'Rejected'
  }
  return labels[status] || status
}
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
.correction-report-btn {
  position: relative;
}
.correction-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-danger);
  color: #fff;
  font-size: .65rem;
  font-weight: 700;
  padding: 0 4px;
  margin-left: 4px;
}
.correction-panel {
  margin-top: 10px;
}
.correction-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: .8rem;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.correction-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg);
}
.correction-list {
  margin-top: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.correction-status-text {
  padding: 10px 12px;
  font-size: .82rem;
  color: var(--color-muted);
}
.correction-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.correction-item:last-child {
  border-bottom: none;
}
.corr-item--accepted {
  background: rgba(34, 197, 94, 0.04);
}
.corr-item--rejected {
  opacity: 0.6;
}
.correction-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.correction-item-category {
  font-size: .75rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 4px;
}
.corr-cat--wrong_answer {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}
.corr-cat--unclear {
  background: rgba(234, 179, 8, 0.1);
  color: #a16207;
}
.corr-cat--typo {
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
}
.corr-cat--other {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
}
.correction-item-status {
  font-size: .7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.corr-status--open {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}
.corr-status--accepted {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
}
.corr-status--rejected {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
}
.correction-item-msg {
  font-size: .82rem;
  color: var(--color-text);
  line-height: 1.5;
  margin: 0;
}
.correction-item-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
</style>
