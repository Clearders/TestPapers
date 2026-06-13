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
import { computed, ref } from 'vue'
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
