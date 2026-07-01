<template>
  <div class="gen-field">
    <label id="gen-subjects-label" class="form-label">Subjects</label>
    <div v-if="availableSubjects.length" class="gen-subject-pool" role="group" aria-labelledby="gen-subjects-label">
      <button
        v-for="subject in availableSubjects"
        :key="subject"
        type="button"
        class="gen-subject-chip"
        :class="{ 'gen-subject-chip--active': generationForm.subjects.includes(subject) }"
        @click="toggleSubject(subject)"
      >{{ subject }}</button>
    </div>
    <div v-else-if="isLoadingMeta" class="gen-subject-loading" aria-live="polite">
      Loading subjects...
    </div>
    <p v-else-if="metaError" class="form-hint form-hint--error" role="status" aria-live="polite">{{ metaError }}</p>
    <p v-else class="form-hint">No subjects available. Create questions with subjects first.</p>
  </div>
</template>

<script setup lang="ts">
import type { GenerationFormState } from '~/types/generation'

const props = defineProps<{
  generationForm: GenerationFormState
  availableSubjects: string[]
  isLoadingMeta: boolean
  metaError: string
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
}>()

function toggleSubject (subject: string) {
  const form = { ...props.generationForm }
  const index = form.subjects.indexOf(subject)
  if (index === -1) {
    form.subjects = [...form.subjects, subject]
  } else {
    form.subjects = form.subjects.filter(s => s !== subject)
  }
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

.gen-subject-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}

.gen-subject-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color .22s ease, color .22s ease, background .22s ease, transform .22s var(--ease-spring), box-shadow .22s ease;
  animation: genChipIn .24s var(--ease-out) both;
}

.gen-subject-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.gen-subject-chip--active {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}

.gen-subject-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
}

@keyframes genChipIn {
  from { opacity: 0; transform: translateY(6px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
