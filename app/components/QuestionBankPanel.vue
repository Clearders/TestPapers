<template>
  <div class="bank-panel">
    <div class="panel-head">
      <div>
        <h2><AppIcon name="search" /> Question Bank</h2>
        <p class="panel-sub">Loaded from the backend question service.</p>
      </div>
      <span class="tag count-tag">{{ currentQuestions.length }} / {{ activePagination.total }}</span>
    </div>

    <QuestionBankToolbar
      v-model:search="searchModel"
      v-model:filter-subject="filterSubjectModel"
      v-model:filter-difficulty="filterDifficultyModel"
      :bank-mode="bankMode"
      :subjects="availableSubjects"
      :can-create-questions="canCreateQuestions"
      @switch-bank-mode="onSwitchBankMode"
    />

    <QuestionCardList
      :questions="currentQuestions"
      :paper-question-ids="paperQuestionIds"
      :loading="activeLoading"
      :question-error="questionError"
      :shown-ids="shownIds"
      :pagination="activePagination"
      :can-read-answers="canReadAnswers"
      :can-review="canReview"
      :can-delete-question="canDeleteQuestion"
      :can-edit-question="canEditQuestion"
      :can-create-questions="canCreateQuestions"
      @toggle-question="(q) => emit('toggle-question', q)"
      @edit="(q) => emit('edit', q)"
      @report="(q) => emit('report', q)"
      @delete="(q) => emit('delete', q)"
      @page-change="(p) => emit('page-change', p)"
      @toggle-answer="(id) => emit('toggle-answer', id)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiPagination } from '~/types/api'
import type { Question, QuestionDifficulty } from '~/types/question'
import type { BankMode } from '~/domain/papers'

const props = defineProps<{
  search: string
  filterSubject: string
  filterDifficulty: QuestionDifficulty | ''
  bankMode: BankMode
  availableSubjects: string[]
  canCreateQuestions: boolean
  currentQuestions: Question[]
  activePagination: ApiPagination
  activeLoading: boolean
  questionError: string
  shownIds: Set<number>
  paperQuestionIds: Set<number>
  canReadAnswers: boolean
  canReview: boolean
  canDeleteQuestion: (q: Question) => boolean
  canEditQuestion: (q: Question) => boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:filterSubject': [value: string]
  'update:filterDifficulty': [value: QuestionDifficulty | '']
  'switch-bank-mode': [mode: BankMode]
  'toggle-question': [question: Question]
  'edit': [question: Question]
  'report': [question: Question]
  'delete': [question: Question]
  'page-change': [page: number]
  'toggle-answer': [id: number]
}>();

const searchModel = computed({
  get: () => props.search,
  set: (v: string) => emit('update:search', v)
})
const filterSubjectModel = computed({
  get: () => props.filterSubject,
  set: (v: string) => emit('update:filterSubject', v)
})
const filterDifficultyModel = computed({
  get: () => props.filterDifficulty,
  set: (v: QuestionDifficulty | '') => emit('update:filterDifficulty', v)
})

function onSwitchBankMode (mode: BankMode) {
  emit('switch-bank-mode', mode)
}
</script>

<style scoped>
.bank-panel {
  min-width: 0;
  animation: revealUp 0.56s var(--ease-out) 0.08s both;
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
.count-tag {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-solid));
  color: var(--color-primary-d);
}
</style>
