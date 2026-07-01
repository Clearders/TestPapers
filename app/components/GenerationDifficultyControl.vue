<template>
  <div class="gen-field">
    <div class="gen-field__label-row">
      <label class="form-label" for="gen-difficulty">Difficulty</label>
      <span class="gen-diff-badge" :class="difficultyBadgeClass">{{ difficultyLabel }}</span>
    </div>
    <div class="gen-range-wrap">
      <input
        id="gen-difficulty"
        :value="generationForm.difficultyCoefficient"
        class="gen-range"
        type="range"
        min="0"
        max="1"
        step="0.05"
        @input="updateDifficultyCoefficient(Number(($event.target as HTMLInputElement).value))"
      >
      <div class="gen-range-ticks">
        <span>Easy</span>
        <span>Medium</span>
        <span>Hard</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GenerationFormState } from '~/types/generation'

const props = defineProps<{
  generationForm: GenerationFormState
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
}>()

function updateDifficultyCoefficient (value: number) {
  const form = { ...props.generationForm }
  form.difficultyCoefficient = value
  emit('update:generationForm', form)
}

const difficultyLabel = computed(() => {
  const coeff = props.generationForm.difficultyCoefficient
  if (coeff <= 0.3) return 'Easy'
  if (coeff <= 0.55) return 'Easy-Medium'
  if (coeff <= 0.75) return 'Medium-Hard'
  return 'Hard'
})

const difficultyBadgeClass = computed(() => {
  const coeff = props.generationForm.difficultyCoefficient
  if (coeff <= 0.3) return 'badge-easy'
  if (coeff <= 0.55) return 'badge-medium'
  return 'badge-hard'
})
</script>

<style scoped>
.gen-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
  animation: revealUp .34s var(--ease-out) both;
}

.gen-field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gen-diff-badge {
  flex-shrink: 0;
}

.gen-range-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gen-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--color-success), #eab308, #ef4444);
  appearance: none;
  cursor: pointer;
}

.gen-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  transition: transform .18s var(--ease-spring), box-shadow .18s ease;
}

.gen-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 7px rgba(118, 87, 255, .12);
}

.gen-range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: .7rem;
  color: var(--color-muted);
  padding: 0 2px;
}
</style>
