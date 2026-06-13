<template>
  <form v-if="canWritePapers" class="card generation-card" @submit.prevent="$emit('generate')">
    <div class="gen-header">
      <div class="gen-header__text">
        <h2>Auto Generate</h2>
        <p>Use a genetic algorithm to compose a balanced paper from the question bank.</p>
      </div>
      <Transition name="gen-stat-pop">
        <div v-if="generationDiagnostics" class="gen-fitness-badge" :class="fitnessClass" :title="'Generations run: ' + generationDiagnostics.generationsRun">
          <span class="gen-fitness-value">{{ generationDiagnostics.fitness.toFixed(2) }}</span>
          <span class="gen-fitness-label">fitness</span>
        </div>
      </Transition>
    </div>

    <div class="gen-controls">
      <div class="gen-field">
        <label class="form-label">Subjects</label>
        <div v-if="availableSubjects.length" class="gen-subject-pool">
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
          Loading subjects…
        </div>
        <p v-else class="form-hint">No subjects available. Create questions with subjects first.</p>
      </div>

      <div class="gen-field">
        <label class="form-label">Total Score</label>
        <div class="gen-pill-group">
          <button
            v-for="score in [50, 100, 120, 150]"
            :key="score"
            type="button"
            class="gen-pill"
            :class="{ 'gen-pill--active': totalMarks === score }"
            @click="$emit('update:totalMarks', score)"
          >{{ score }}</button>
          <input
            :value="totalMarks"
            class="gen-pill-input"
            type="number"
            min="1"
            placeholder="Custom"
            @input="$emit('update:totalMarks', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

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
            <span v-if="generationForm.questionTypes.includes(type)" class="gen-type-option-check">✓</span>
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
            />
          </div>
        </div>
      </div>

      <div class="gen-field">
        <div class="gen-field__label-row">
          <label class="form-label">Difficulty</label>
          <span class="gen-diff-badge" :class="difficultyBadgeClass">{{ difficultyLabel }}</span>
        </div>
        <div class="gen-range-wrap">
          <input
            :value="generationForm.difficultyCoefficient"
            class="gen-range"
            type="range"
            min="0"
            max="1"
            step="0.05"
            @input="updateDifficultyCoefficient(Number(($event.target as HTMLInputElement).value))"
          />
          <div class="gen-range-ticks">
            <span>Easy</span>
            <span>Medium</span>
            <span>Hard</span>
          </div>
        </div>
      </div>

      <div class="gen-field">
        <label class="form-label">Tag Filters <span class="gen-optional">(optional)</span></label>
        <div v-if="availableTags.length" class="gen-tag-pool">
          <button
            v-for="tag in availableTags"
            :key="tag"
            type="button"
            class="gen-tag-chip"
            :class="tagChipClass(tag)"
            @click="toggleTag($event, tag)"
          >{{ tag }}</button>
        </div>
        <div v-else-if="isLoadingMeta" class="gen-tag-loading" aria-live="polite">
          Loading tags…
        </div>
        <div v-if="selectedTagsDisplay.length" class="gen-selected-tags">
          <span
            v-for="tag in selectedTagsDisplay"
            :key="tag.value"
            class="gen-selected-pill"
            :class="'gen-spill--' + tag.group"
          >
            {{ tag.value }}
            <button type="button" class="gen-pill-remove" @click="removeTag(tag.value)" aria-label="Remove">×</button>
          </span>
        </div>
        <input
          v-model="customTagInputModel"
          class="form-input gen-tag-input"
          placeholder="Type custom tag and press Enter…"
          @keydown.enter.prevent="addCustomTag"
        />
        <p class="form-hint">Click a tag to add as Required; Shift+click for Preferred. Tap × to remove.</p>
      </div>
    </div>

    <div class="gen-action">
      <button
        class="btn btn-primary gen-submit"
        type="submit"
        :disabled="isGenerating || !generationForm.subjects.length || !paperTitle.trim() || !generationForm.questionTypes.length"
      >
        <span v-if="isGenerating" class="gen-spinner"></span>
        {{ isGenerating ? 'Generating…' : 'Generate Paper' }}
      </button>
      <span class="form-hint">Uses the paper title, duration, and the generation subject above.</span>
    </div>

    <Transition name="gen-banner">
      <div v-if="generationError" class="status-banner status-banner--error" aria-live="polite">
        {{ generationError }}
      </div>
    </Transition>

    <Transition name="gen-banner">
      <div v-if="generationDiagnostics" class="gen-result">
        <div class="gen-result-header">
          <span class="gen-result-title">Generation Result</span>
          <span class="gen-result-meta">{{ generationDiagnostics.questionCount }} questions · {{ generationDiagnostics.candidateCount }} candidates · {{ generationDiagnostics.generationsRun }} generations</span>
        </div>
        <div class="gen-stats">
          <div class="gen-stat">
            <span class="gen-stat-label">Marks</span>
            <span class="gen-stat-value">{{ generationDiagnostics.marksActual }}</span>
          </div>
          <div class="gen-stat">
            <span class="gen-stat-label">Weight</span>
            <span class="gen-stat-value">{{ generationDiagnostics.scoreWeightActual }}</span>
          </div>
          <div class="gen-stat">
            <span class="gen-stat-label">Difficulty</span>
            <span class="gen-stat-value gen-stat--small">{{ formatDistribution(generationDiagnostics.difficultyActual) }}</span>
          </div>
          <div class="gen-stat">
            <span class="gen-stat-label">Type</span>
            <span class="gen-stat-value gen-stat--small">{{ formatDistribution(generationDiagnostics.typeActual) }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </form>
  <div v-else class="card generation-card">
    <div class="gen-header">
      <div class="gen-header__text">
        <h2>Auto Generate</h2>
        <p>Paper generation requires <strong>papers:write</strong> permission.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestionType } from '~/types/question'
import type { GenerationDiagnostics, GenerationFormState } from '~/types/generation'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from '~/domain/questions'

const props = defineProps<{
  generationForm: GenerationFormState
  canWritePapers: boolean
  isGenerating: boolean
  generationError: string
  generationDiagnostics: GenerationDiagnostics | null
  availableSubjects: string[]
  availableTags: string[]
  isLoadingMeta: boolean
  totalMarks: number
  paperTitle: string
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
  'update:totalMarks': [value: number]
  generate: []
}>()

const customTagInputModel = ref(props.generationForm.customTagInput)

watch(() => props.generationForm.customTagInput, (val) => {
  customTagInputModel.value = val
})

function toggleQuestionType (type: QuestionType) {
  const form = { ...props.generationForm }
  const index = form.questionTypes.indexOf(type)
  if (index === -1) {
    form.questionTypes = [...form.questionTypes, type]
    form.typeCounts = { ...form.typeCounts, [type]: form.typeCounts[type] || 1 }
  } else {
    form.questionTypes = form.questionTypes.filter(t => t !== type)
    const newCounts = { ...form.typeCounts }
    delete newCounts[type]
    form.typeCounts = newCounts
  }
  emit('update:generationForm', form)
}

function updateTypeCount (type: QuestionType, value: number) {
  const form = { ...props.generationForm }
  form.typeCounts = { ...form.typeCounts, [type]: value || 1 }
  emit('update:generationForm', form)
}

function updateDifficultyCoefficient (value: number) {
  const form = { ...props.generationForm }
  form.difficultyCoefficient = value
  emit('update:generationForm', form)
}

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

function toggleTag (event: MouseEvent, tag: string) {
  const form = { ...props.generationForm }
  const shift = event.shiftKey
  if (form.requiredTags.includes(tag)) {
    form.requiredTags = form.requiredTags.filter(t => t !== tag)
  } else if (form.preferredTags.includes(tag)) {
    form.preferredTags = form.preferredTags.filter(t => t !== tag)
  } else if (shift) {
    form.preferredTags = [...form.preferredTags, tag]
  } else {
    form.requiredTags = [...form.requiredTags, tag]
  }
  emit('update:generationForm', form)
}

function removeTag (tag: string) {
  const form = { ...props.generationForm }
  form.requiredTags = form.requiredTags.filter(t => t !== tag)
  form.preferredTags = form.preferredTags.filter(t => t !== tag)
  emit('update:generationForm', form)
}

function addCustomTag () {
  const input = customTagInputModel.value.trim()
  if (!input) return
  const tags = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const form = { ...props.generationForm }
  for (const tag of tags) {
    if (!form.requiredTags.includes(tag) && !form.preferredTags.includes(tag)) {
      form.requiredTags = [...form.requiredTags, tag]
    }
  }
  customTagInputModel.value = ''
  emit('update:generationForm', form)
}

const selectedTagsDisplay = computed(() => {
  const display: { value: string; group: string }[] = []
  for (const tag of props.generationForm.requiredTags) {
    if (!display.some(d => d.value === tag)) display.push({ value: tag, group: 'required' })
  }
  for (const tag of props.generationForm.preferredTags) {
    const existing = display.find(d => d.value === tag)
    if (existing) existing.group = 'both'
    else display.push({ value: tag, group: 'preferred' })
  }
  return display
})

const fitnessClass = computed(() => {
  if (!props.generationDiagnostics) return ''
  const f = props.generationDiagnostics.fitness
  if (f >= 0.85) return 'gen-fitness--high'
  if (f >= 0.60) return 'gen-fitness--mid'
  return 'gen-fitness--low'
})

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

function tagChipClass (tag: string) {
  if (props.generationForm.requiredTags.includes(tag)) return 'gen-chip--required'
  if (props.generationForm.preferredTags.includes(tag)) return 'gen-chip--preferred'
  return ''
}

function formatDistribution (distribution: Record<string, number>) {
  return Object.entries(distribution)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ') || '-'
}
</script>

<style scoped>
.generation-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  background:
    linear-gradient(135deg, rgba(79, 110, 247, 0.06), rgba(34, 197, 94, 0.03)),
    var(--color-surface);
}

.gen-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
.gen-header__text h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.gen-header__text p {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 3px;
}

.gen-fitness-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: 6px 14px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  flex-shrink: 0;
}
.gen-fitness--high {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}
.gen-fitness--mid {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.25);
}
.gen-fitness--low {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
}
.gen-fitness-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}
.gen-fitness--high .gen-fitness-value { color: #15803d; }
.gen-fitness--mid .gen-fitness-value { color: #a16207; }
.gen-fitness--low .gen-fitness-value { color: #b91c1c; }
.gen-fitness-label {
  font-size: .65rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.gen-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 20px;
}

.gen-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.gen-optional {
  font-weight: 400;
  color: var(--color-muted);
  font-size: .8rem;
}

.gen-pill-group {
  display: flex;
  align-items: center;
  background: var(--color-border);
  padding: 3px;
  border-radius: 999px;
  gap: 2px;
  overflow-x: auto;
}
.gen-pill {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: .82rem;
  font-weight: 500;
  color: var(--color-muted);
  text-align: center;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
  cursor: pointer;
}
.gen-pill:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.45);
}

[data-theme="dark"] .gen-pill:hover {
  background: rgba(255, 255, 255, 0.08);
}
.gen-pill--active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.gen-pill-input {
  width: 64px;
  border-radius: 999px;
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

.gen-type-list {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
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
  transition: background 0.2s ease, color 0.2s ease;
  text-align: left;
  width: 100%;
}
.gen-type-option:last-child {
  border-bottom: none;
}
.gen-type-option:hover {
  background: rgba(79, 110, 247, 0.04);
  color: var(--color-text);
}
.gen-type-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 0;
}
.gen-type-option--active {
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
  border-left: 3px solid var(--color-primary);
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
  border-radius: 999px;
  padding: 2px 2px 2px 12px;
}

.gen-type-count-label {
  font-size: .78rem;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
}

.gen-type-count-input {
  width: 48px;
  border-radius: 999px;
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

.gen-range-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gen-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #22c55e, #eab308, #ef4444);
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
  transition: transform 0.15s ease;
}
.gen-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.gen-range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: .7rem;
  color: var(--color-muted);
  padding: 0 2px;
}

.gen-tag-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}
.gen-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.gen-tag-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
}
.gen-chip--required {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}
.gen-chip--preferred {
  border-color: var(--color-accent);
  background: rgba(34, 197, 94, 0.08);
  color: #15803d;
  font-weight: 600;
}

.gen-tag-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
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
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.gen-subject-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
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

.gen-selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.gen-selected-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 500;
}
.gen-spill--required {
  background: rgba(79, 110, 247, 0.12);
  color: var(--color-primary);
  border: 1px solid rgba(79, 110, 247, 0.25);
}
.gen-spill--preferred {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.gen-spill--both {
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.12), rgba(34, 197, 94, 0.12));
  color: var(--color-text);
  border: 1px solid rgba(79, 110, 247, 0.25);
}
.gen-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: .85rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}
.gen-pill-remove:hover {
  opacity: 1;
}

.gen-tag-input {
  font-size: .82rem;
  margin-top: 8px;
}

.gen-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 16px;
  margin-top: 2px;
  border-top: 1px solid var(--color-border);
}
.gen-submit {
  min-width: 160px;
  justify-content: center;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.gen-submit:not(:disabled) {
  animation: genPulse 2.5s ease-in-out infinite;
}
@keyframes genPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.25); }
  50% { box-shadow: 0 0 0 6px rgba(79, 110, 247, 0); }
}
.gen-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: genSpin 0.6s linear infinite;
}
@keyframes genSpin {
  to { transform: rotate(360deg); }
}

.gen-result {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.gen-result-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.gen-result-title {
  font-size: .85rem;
  font-weight: 700;
  color: var(--color-text);
}
.gen-result-meta {
  font-size: .75rem;
  color: var(--color-muted);
}
.gen-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.gen-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: var(--radius);
  background: rgba(79, 110, 247, 0.04);
  border: 1px solid rgba(79, 110, 247, 0.08);
}
.gen-stat-label {
  font-size: .68rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.gen-stat-value {
  font-size: .95rem;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.gen-stat--small {
  font-size: .75rem;
  font-weight: 600;
  text-align: center;
}

.gen-stat-pop-enter-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.gen-stat-pop-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.gen-stat-pop-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.gen-stat-pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.gen-banner-enter-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.gen-banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.gen-banner-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.gen-banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.status-banner {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: #f8fafc;
  color: var(--color-muted);
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: .875rem;
}
.status-banner--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
@media (max-width: 560px) {
  .gen-tag-pool {
    max-height: 200px;
  }

  .gen-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .gen-action {
    align-items: stretch;
    flex-direction: column;
  }

  .gen-action .btn {
    width: 100%;
  }
}

[data-theme="dark"] .status-banner {
  background: rgba(30, 41, 59, 0.6);
}

[data-theme="dark"] .status-banner--error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: #fca5a5;
}
</style>
