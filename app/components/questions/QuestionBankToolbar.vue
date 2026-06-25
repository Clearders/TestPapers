<template>
  <div>
    <div class="bank-mode-tabs">
      <button
        class="btn btn-sm"
        :class="bankMode === 'all' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'all')"
      >
        <AppIcon name="book" />
        All Questions
      </button>
      <button
        class="btn btn-sm"
        :class="bankMode === 'mine' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'mine')"
      >
        <AppIcon name="account" />
        My Questions
      </button>
    </div>

    <div v-if="subjects.length" class="subject-tabs">
      <button
        :class="['btn btn-sm', filterSubject === '' ? 'btn-primary' : 'btn-outline']"
        @click="$emit('update:filterSubject', '')"
      >
        All
      </button>
      <button
        v-for="sub in subjects"
        :key="sub"
        :class="['btn btn-sm', filterSubject === sub ? 'btn-primary' : 'btn-outline']"
        @click="$emit('update:filterSubject', sub)"
      >
        {{ sub }}
      </button>
    </div>

    <div class="toolbar card">
      <label class="search-wrap">
        <AppIcon name="search" />
        <input
          :value="search"
          class="form-input search-input"
          name="search"
          autocomplete="off"
          placeholder="Search questions…"
          aria-label="Search questions"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="filter-wrap">
        <AppIcon name="filter" />
        <select
          :value="filterDifficulty"
          class="form-input"
          name="difficulty"
          aria-label="Filter by difficulty"
          @change="onDifficultyChange"
        >
          <option value="">All difficulties</option>
          <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">
        <AppIcon name="add" />
        Add Problem
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionDifficulty } from '~/types/question'
import { DIFFICULTY_OPTIONS, isQuestionDifficulty } from '~/domain/questions'

defineProps<{
  bankMode: 'all' | 'mine'
  search: string
  filterSubject: string
  filterDifficulty: QuestionDifficulty | ''
  subjects: string[]
  canCreateQuestions: boolean
}>()

const emit = defineEmits<{
  'switch-bank-mode': [mode: 'all' | 'mine']
  'update:search': [value: string]
  'update:filterSubject': [value: string]
  'update:filterDifficulty': [value: QuestionDifficulty | '']
}>()

function onDifficultyChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value

  if (value === '' || isQuestionDifficulty(value)) {
    emit('update:filterDifficulty', value)
  }
}
</script>

<style scoped>
.bank-mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  animation: revealUp .38s var(--ease-out) both;
}
.subject-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  animation: revealUp .38s var(--ease-out) .06s both;
}
.bank-mode-tabs .btn,
.subject-tabs .btn {
  border-radius: var(--radius-pill);
}
.subject-tabs .btn {
  animation: chipIn .24s var(--ease-out) both;
}
.subject-tabs .btn:nth-child(2n) { animation-delay: .03s; }
.subject-tabs .btn:nth-child(3n) { animation-delay: .06s; }
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
  position: relative;
  overflow: hidden;
  animation: revealUp .42s var(--ease-out) .1s both;
}
.search-wrap,
.filter-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 210px;
  min-width: 0;
}
.search-wrap > svg,
.filter-wrap > svg {
  position: absolute;
  left: 12px;
  z-index: 1;
  color: var(--color-muted);
  transition: color .18s ease, transform .18s ease;
}
.search-wrap:focus-within > svg,
.filter-wrap:focus-within > svg {
  color: var(--color-primary);
  transform: scale(1.08);
}
.search-input,
.filter-wrap .form-input {
  padding-left: 38px;
}
.toolbar > .btn {
  flex: 0 0 auto;
}
@media (max-width: 560px) {
  .bank-mode-tabs .btn,
  .subject-tabs .btn,
  .toolbar > .btn,
  .search-wrap,
  .filter-wrap {
    width: 100%;
    flex: 1 1 100%;
  }
}
@keyframes chipIn {
  from { opacity: 0; transform: translateY(6px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
