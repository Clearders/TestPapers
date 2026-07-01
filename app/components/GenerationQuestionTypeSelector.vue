<template>
  <div class="gen-field">
    <label class="form-label">Question Type</label>
    <div
      class="gen-type-list"
      role="listbox"
      aria-label="Question types"
      aria-multiselectable="true"
    >
      <button
        v-for="type in QUESTION_TYPE_ORDER"
        :key="type"
        type="button"
        class="gen-type-option"
        :class="{ 'gen-type-option--active': generationForm.questionTypes.includes(type) }"
        role="option"
        :aria-selected="generationForm.questionTypes.includes(type)"
        @click="toggleQuestionType(type)"
      >
        <span class="gen-type-option-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
        <AppIcon
          v-if="generationForm.questionTypes.includes(type)"
          name="check"
          class="gen-type-option-check"
        />
      </button>
    </div>
    <div v-if="generationForm.questionTypes.length" class="gen-type-counts">
      <div v-for="type in generationForm.questionTypes" :key="type" class="gen-type-count-row">
        <span class="gen-type-count-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
        <input
          :value="generationForm.typeCounts[type]"
          class="gen-type-count-input"
          type="number"
          min="1"
          @input="updateTypeCount(type, Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GenerationFormState } from '~/types/generation'
import type { QuestionType } from '~/types/question'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from '~/domain/questions'

const props = defineProps<{
  generationForm: GenerationFormState
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
}>()

function toggleQuestionType (type: QuestionType) {
  const form = { ...props.generationForm }
  const index = form.questionTypes.indexOf(type)
  if (index === -1) {
    form.questionTypes = [...form.questionTypes, type]
    form.typeCounts = { ...form.typeCounts, [type]: form.typeCounts[type] || 1 }
  } else {
    form.questionTypes = form.questionTypes.filter(t => t !== type)
    const { [type]: _removed, ...restCounts } = form.typeCounts
    form.typeCounts = restCounts
  }
  emit('update:generationForm', form)
}

function updateTypeCount (type: QuestionType, value: number) {
  const form = { ...props.generationForm }
  form.typeCounts = { ...form.typeCounts, [type]: value || 1 }
  emit('update:generationForm', form)
}
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

.gen-type-list {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.gen-type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 6px 14px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-size: .85rem;
  font-weight: 500;
  color: var(--color-muted);
  transition: background .22s ease, color .22s ease, transform .22s var(--ease-out), border-color .22s ease, box-shadow .22s ease;
  text-align: left;
  width: 100%;
}

.gen-type-option:last-child {
  border-bottom: none;
}

.gen-type-option:hover {
  background: rgba(79, 110, 247, 0.04);
  color: var(--color-text);
  transform: translateX(2px);
}

.gen-type-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 0;
}

.gen-type-option--active {
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
  font-weight: 800;
  border-left: 3px solid var(--color-primary);
  box-shadow: inset 12px 0 22px rgba(118, 87, 255, .08);
}

.gen-type-option--active:hover {
  background: rgba(79, 110, 247, 0.1);
}

.gen-type-option-label {
  flex: 1;
}

.gen-type-option-check {
  font-size: .7rem;
  color: var(--color-accent);
  font-weight: 700;
  flex-shrink: 0;
}

.gen-type-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.gen-type-count-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-border);
  border-radius: var(--radius-pill);
  padding: 2px 2px 2px 12px;
  animation: genChipIn .24s var(--ease-out) both;
}

.gen-type-count-label {
  font-size: .78rem;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
}

.gen-type-count-input {
  width: 48px;
  border-radius: var(--radius-pill);
  border: none;
  text-align: center;
  padding: 4px 6px;
  font-size: .82rem;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s ease;
}

.gen-type-count-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

@keyframes genChipIn {
  from { opacity: 0; transform: translateY(6px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
