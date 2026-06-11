<template>
  <div>
    <div class="bank-mode-tabs">
      <button
        class="btn btn-sm"
        :class="bankMode === 'all' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'all')"
      >
        All Questions
      </button>
      <button
        class="btn btn-sm"
        :class="bankMode === 'mine' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'mine')"
      >
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
      <input
        :value="search"
        class="form-input search-input"
        name="search"
        autocomplete="off"
        placeholder="Search questions…"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
      <select
        :value="filterDifficulty"
        class="form-input"
        name="difficulty"
        @change="onDifficultyChange"
      >
        <option value="">All difficulties</option>
        <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">+ Add Problem</NuxtLink>
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
}
.subject-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.search-input {
  flex: 1;
  min-width: 180px;
}
.toolbar > .form-input,
.toolbar > .btn {
  flex: 1 1 180px;
}
@media (max-width: 560px) {
  .bank-mode-tabs .btn,
  .subject-tabs .btn,
  .toolbar > .form-input,
  .toolbar > .btn {
    width: 100%;
  }
}
</style>
