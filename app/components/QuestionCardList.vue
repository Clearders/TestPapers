<template>
  <div v-if="questionError" class="status-banner status-banner--error" role="alert" aria-live="polite">
    {{ questionError }}
  </div>

  <div v-if="deleteError" class="status-banner status-banner--error" role="alert" aria-live="polite">
    {{ deleteError }}
  </div>

  <div v-if="loading" class="status-banner" aria-live="polite">
    <AppIcon name="sparkles" />
    Loading questions…
  </div>

  <TransitionGroup v-if="questions.length" name="list" tag="div" class="q-list">
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
      @view-detail="$emit('view-detail', q)"
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
      <span class="empty-icon"><AppIcon name="search" /></span>
      <p>No questions match the current filters.</p>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">
        <AppIcon name="add" />
        Create a Problem
      </NuxtLink>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Question } from '~/types/question'
import type { ApiPagination } from '~/types/api'
import { QUESTION_TYPE_LABELS } from '~/domain/questions'
import QuestionBankCard from '~/components/questions/QuestionBankCard.vue'
import PaginationControls from '~/components/questions/PaginationControls.vue'
import { apiErrorMessage } from '~/utils/apiError'

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
  'view-detail': [q: Question]
  edit: [q: Question]
  report: [q: Question]
  delete: [q: Question]
  'page-change': [page: number]
}>()

const { deleteQuestion } = useQuestionBank()
const deleteError = ref('')

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
  deleteError.value = ''
  try {
    await deleteQuestion(question.publicId)
    emit('delete', question)
  } catch (err) {
    deleteError.value = apiErrorMessage(err, 'Failed to delete question.')
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

.empty-state {
  text-align: center;
  color: var(--color-muted);
}
.empty-icon {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: var(--radius);
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
}

</style>
