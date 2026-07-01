<template>
  <div class="gen-field">
    <label id="gen-score-label" class="form-label">Total Score</label>
    <div class="gen-pill-group" role="group" aria-labelledby="gen-score-label">
      <button
        v-for="score in scoreOptions"
        :key="score"
        type="button"
        class="gen-pill"
        :class="{ 'gen-pill--active': totalMarks === score }"
        @click="emit('update:totalMarks', score)"
      >{{ score }}</button>
      <input
        :value="totalMarks"
        class="gen-pill-input"
        type="number"
        min="1"
        placeholder="Custom"
        @input="emit('update:totalMarks', Number(($event.target as HTMLInputElement).value))"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalMarks: number
}>()

const emit = defineEmits<{
  'update:totalMarks': [value: number]
}>()

const scoreOptions = [50, 100, 120, 150]
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

.gen-pill-group {
  display: flex;
  align-items: center;
  background: var(--color-border);
  padding: 3px;
  border-radius: var(--radius-pill);
  gap: 2px;
  overflow-x: auto;
}

.gen-pill {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  padding: 5px 10px;
  font-size: .82rem;
  font-weight: 500;
  color: var(--color-muted);
  text-align: center;
  white-space: nowrap;
  transition: background .22s ease, color .22s ease, transform .22s var(--ease-spring), box-shadow .22s ease;
  cursor: pointer;
}

.gen-pill:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.45);
  transform: translateY(-2px);
}

[data-theme="dark"] .gen-pill:hover {
  background: rgba(255, 255, 255, 0.08);
}

.gen-pill--active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  animation: selectedPulse .32s var(--ease-out) both;
}

.gen-pill-input {
  width: 64px;
  border-radius: var(--radius-pill);
  border: none;
  text-align: center;
  padding: 5px;
  font-size: .82rem;
  font-weight: 500;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s ease;
}

.gen-pill-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

@keyframes selectedPulse {
  from { transform: scale(.96); }
  to { transform: scale(1); }
}
</style>
