<template>
  <div v-if="questionError" class="status-banner status-banner--error">
    {{ questionError }}
  </div>

  <div v-if="loading" class="status-banner" aria-live="polite">
    Loading questions…
  </div>

  <TransitionGroup name="list" tag="div" class="q-list" v-if="questions.length">
    <QuestionBankCard
      v-for="(q, index) in questions"
      :key="q.id"
      :question="q"
      :index="index"
      :can-read-answers="canReadAnswers"
      :is-shown="isShown(q.id)"
      :is-added="isAdded(q.id)"
      :type-label="typeLabel"
      :can-edit="canEditQuestion(q)"
      :can-review="canReview"
      :can-delete="canDeleteQuestion(q)"
      @toggle-answer="toggleAnswer"
      @toggle-question="$emit('toggle-question', q)"
      @edit="$emit('edit', q)"
      @report="$emit('report', q)"
      @delete="handleDeleteQuestion(q)"
    />
  </TransitionGroup>

  <PaginationControls
    :pagination="pagination"
    :loading="loading"
    @change="goToPage"
  />

  <Transition name="fade">
    <div v-if="!loading && !questions.length" class="empty-state card">
      <p>No questions match the current filters.</p>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">Create a Problem</NuxtLink>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Question } from '~/types/question'
import type { ApiPagination } from '~/types/api'
import { QUESTION_TYPE_LABELS } from '~/domain/questions'
import QuestionBankCard from '~/components/questions/QuestionBankCard.vue'
import PaginationControls from '~/components/questions/PaginationControls.vue'

const props = defineProps<{
  questions: Question[]
  paperQuestionIds: Set<number>
  loading: boolean
  questionError: string
  shownIds: Set<number>
  pagination: ApiPagination
  canReadAnswers: boolean
  canReview: boolean
  canDeleteQuestion: (q: Question) => boolean
  canEditQuestion: (q: Question) => boolean
  canCreateQuestions: boolean
}>()

const emit = defineEmits<{
  'toggle-answer': [id: number]
  'toggle-question': [q: Question]
  edit: [q: Question]
  report: [q: Question]
  delete: [q: Question]
  'page-change': [page: number]
}>()

const { deleteQuestion } = useQuestionBank()

function isShown (id: number) {
  return props.shownIds.has(id)
}

function isAdded (id: number) {
  return props.paperQuestionIds.has(id)
}

function toggleAnswer (id: number) {
  emit('toggle-answer', id)
}

function typeLabel (type: Question['type']) {
  return QUESTION_TYPE_LABELS[type] || type
}

function goToPage (page: number) {
  emit('page-change', page)
}

async function handleDeleteQuestion (question: Question) {
  if (!window.confirm(`Delete question #${question.id}? This will also remove all revision history and corrections. This cannot be undone.`)) return
  try {
    await deleteQuestion(question.publicId)
    emit('delete', question)
  } catch (err) {
    console.error('[QuestionCardList] Failed to delete question:', err)
    if (!window.confirm('Failed to delete. Remove from local list anyway?')) return
    emit('delete', question)
  }
}
</script>

<style scoped>
.q-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
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

.empty-state {
  text-align: center;
  color: var(--color-muted);
}

[data-theme="dark"] .status-banner {
  background: rgba(30, 41, 59, 0.6);
}

[data-theme="dark"] .status-banner--error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: #fca5a5;
}
</style>
