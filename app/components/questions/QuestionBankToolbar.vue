<template>
  <div class="bank-tools">
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

    <div class="toolbar card">
      <label class="search-wrap">
        <AppIcon name="search" />
        <input
          :value="search"
          class="form-input search-input"
          name="search"
          autocomplete="off"
          placeholder="Search questions, keywords, sources, or formulas..."
          aria-label="Search questions"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <button v-if="canCreateQuestions" class="btn btn-outline" type="button" @click="$emit('open-import')">
        <AppIcon name="upload" />
        Import
      </button>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">
        <AppIcon name="add" />
        Add Problem
      </NuxtLink>
    </div>

    <div v-if="subjects.length" class="subject-tabs" aria-label="Subject filters">
      <button
        :class="['btn btn-sm', filterSubject === '' ? 'btn-primary' : 'btn-outline']"
        @click="$emit('update:filterSubject', '')"
      >
        All
      </button>
      <button
        v-for="subject in subjects"
        :key="subject"
        :class="['btn btn-sm', filterSubject === subject ? 'btn-primary' : 'btn-outline']"
        @click="$emit('update:filterSubject', subject)"
      >
        {{ subject }}
      </button>
    </div>

    <div class="advanced-filters card">
      <label class="filter-wrap">
        <AppIcon name="filter" />
        <select
          :value="filterType"
          class="form-input"
          name="type"
          aria-label="Filter by type"
          @change="onTypeChange"
        >
          <option value="">All types</option>
          <option v-for="option in QUESTION_TYPE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
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

      <label class="filter-wrap">
        <AppIcon name="filter" />
        <select
          :value="filterTag"
          class="form-input"
          name="tag"
          aria-label="Filter by tag"
          @change="$emit('update:filterTag', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">All tags</option>
          <option v-for="tag in tags" :key="tag" :value="tag">
            {{ tag }}
          </option>
        </select>
      </label>

      <label class="filter-wrap">
        <AppIcon name="latex" />
        <select
          :value="filterHasLatex"
          class="form-input"
          name="hasLatex"
          aria-label="Filter by LaTeX usage"
          @change="onLatexChange"
        >
          <option value="">Any LaTeX usage</option>
          <option value="true">Contains LaTeX</option>
          <option value="false">No LaTeX</option>
        </select>
      </label>

      <button class="btn btn-outline" type="button" @click="$emit('reset-filters')">
        <AppIcon name="x" />
        Reset Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionDifficulty, QuestionType } from '~/types/question'
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_OPTIONS, isQuestionDifficulty } from '~/domain/questions'

defineProps<{
  bankMode: 'all' | 'mine'
  search: string
  filterSubject: string
  filterDifficulty: QuestionDifficulty | ''
  filterType: QuestionType | ''
  filterTag: string
  filterHasLatex: '' | 'true' | 'false'
  subjects: string[]
  tags: string[]
  canCreateQuestions: boolean
}>()

const emit = defineEmits<{
  'switch-bank-mode': [mode: 'all' | 'mine']
  'update:search': [value: string]
  'update:filterSubject': [value: string]
  'update:filterDifficulty': [value: QuestionDifficulty | '']
  'update:filterType': [value: QuestionType | '']
  'update:filterTag': [value: string]
  'update:filterHasLatex': [value: '' | 'true' | 'false']
  'open-import': []
  'reset-filters': []
}>()

function onDifficultyChange (event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === '' || isQuestionDifficulty(value)) {
    emit('update:filterDifficulty', value)
  }
}

function onTypeChange (event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === '' || QUESTION_TYPE_OPTIONS.some(option => option.value === value)) {
    emit('update:filterType', value as QuestionType | '')
  }
}

function onLatexChange (event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === '' || value === 'true' || value === 'false') {
    emit('update:filterHasLatex', value)
  }
}
</script>

<style scoped>
.bank-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.bank-mode-tabs,
.subject-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  animation: revealUp .38s var(--ease-out) both;
}

.bank-mode-tabs .btn,
.subject-tabs .btn {
  border-radius: var(--radius-pill);
}

.subject-tabs {
  overflow-x: auto;
  padding-bottom: 2px;
}

.toolbar,
.advanced-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
  animation: revealUp .42s var(--ease-out) .08s both;
}

.advanced-filters {
  padding: 14px;
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

.toolbar > .btn,
.advanced-filters > .btn {
  flex: 0 0 auto;
}

@media (max-width: 620px) {
  .toolbar > .btn,
  .advanced-filters > .btn,
  .search-wrap,
  .filter-wrap {
    width: 100%;
    flex: 1 1 100%;
  }
}
</style>
