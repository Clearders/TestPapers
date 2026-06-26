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
      v-model:filter-type="filterTypeModel"
      v-model:filter-tag="filterTagModel"
      v-model:filter-has-latex="filterHasLatexModel"
      :bank-mode="bankMode"
      :subjects="availableSubjects"
      :tags="availableTags"
      :can-create-questions="canCreateQuestions"
      @switch-bank-mode="onSwitchBankMode"
      @open-import="emit('open-import')"
      @reset-filters="emit('reset-filters')"
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
      @view-detail="(q) => emit('view-detail', q)"
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
import type { Question, QuestionDifficulty, QuestionType } from '~/types/question'
import type { BankMode } from '~/domain/papers'

const props = defineProps<{
  search: string
  filterSubject: string
  filterDifficulty: QuestionDifficulty | ''
  filterType: QuestionType | ''
  filterTag: string
  filterHasLatex: '' | 'true' | 'false'
  bankMode: BankMode
  availableSubjects: string[]
  availableTags: string[]
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
  'update:filterType': [value: QuestionType | '']
  'update:filterTag': [value: string]
  'update:filterHasLatex': [value: '' | 'true' | 'false']
  'switch-bank-mode': [mode: BankMode]
  'toggle-question': [question: Question]
  'view-detail': [question: Question]
  'edit': [question: Question]
  'report': [question: Question]
  'delete': [question: Question]
  'page-change': [page: number]
  'toggle-answer': [id: number]
  'open-import': []
  'reset-filters': []
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
const filterTypeModel = computed({
  get: () => props.filterType,
  set: (v: QuestionType | '') => emit('update:filterType', v)
})
const filterTagModel = computed({
  get: () => props.filterTag,
  set: (v: string) => emit('update:filterTag', v)
})
const filterHasLatexModel = computed({
  get: () => props.filterHasLatex,
  set: (v: '' | 'true' | 'false') => emit('update:filterHasLatex', v)
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
