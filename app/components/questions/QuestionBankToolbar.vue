<template>
  <div>
    <div class="bank-mode-tabs">
      <button
        class="btn btn-sm"
        :class="bankMode === 'all' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'all')"
      >
        {{ $t('common.allQuestions') }}
      </button>
      <button
        class="btn btn-sm"
        :class="bankMode === 'mine' ? 'btn-primary' : 'btn-outline'"
        @click="$emit('switch-bank-mode', 'mine')"
      >
        {{ $t('common.myQuestions') }}
      </button>
    </div>

    <div class="toolbar card">
      <input
        :value="search"
        class="form-input search-input"
        :placeholder="$t('common.search')"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
      <select
        :value="filterSubject"
        class="form-input"
        @change="$emit('update:filterSubject', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ $t('common.allSubjects') }}</option>
        <option v-for="subject in subjects" :key="subject" :value="subject">{{ subject }}</option>
      </select>
      <select
        :value="filterDifficulty"
        class="form-input"
        @change="$emit('update:filterDifficulty', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ $t('common.allDifficulties') }}</option>
        <option value="easy">{{ $t('difficulty.easy') }}</option>
        <option value="medium">{{ $t('difficulty.medium') }}</option>
        <option value="hard">{{ $t('difficulty.hard') }}</option>
      </select>
      <NuxtLink v-if="canCreateQuestions" to="/add-problem" class="btn btn-primary">{{ $t('common.addProblem') }}</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionDifficulty } from '~/types/question'

defineProps<{
  bankMode: 'all' | 'mine'
  search: string
  filterSubject: string
  filterDifficulty: QuestionDifficulty | ''
  subjects: string[]
  canCreateQuestions: boolean
}>()

defineEmits<{
  'switch-bank-mode': [mode: 'all' | 'mine']
  'update:search': [value: string]
  'update:filterSubject': [value: string]
  'update:filterDifficulty': [value: QuestionDifficulty | '']
}>()
</script>

<style scoped>
.bank-mode-tabs {
  display: flex;
  gap: 8px;
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
</style>
