<template>
  <form v-if="canWritePapers" class="card generation-card" @submit.prevent="$emit('generate')">
    <div class="gen-header">
      <div class="gen-header__text">
        <h2><AppIcon name="sparkles" /> Auto Generate</h2>
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
      <GenerationSubjectSelector
        :generation-form="generationForm"
        :available-subjects="availableSubjects"
        :is-loading-meta="isLoadingMeta"
        :meta-error="metaError"
        @update:generation-form="emit('update:generationForm', $event)"
      />

      <GenerationScoreControl
        :total-marks="totalMarks"
        @update:total-marks="emit('update:totalMarks', $event)"
      />

      <GenerationQuestionTypeSelector
        :generation-form="generationForm"
        @update:generation-form="emit('update:generationForm', $event)"
      />

      <GenerationDifficultyControl
        :generation-form="generationForm"
        @update:generation-form="emit('update:generationForm', $event)"
      />

      <GenerationTagFilter
        :generation-form="generationForm"
        :available-tags="availableTags"
        :is-loading-meta="isLoadingMeta"
        :meta-error="metaError"
        @update:generation-form="emit('update:generationForm', $event)"
      />
    </div>

    <div class="gen-action">
      <button
        class="btn btn-primary gen-submit"
        type="submit"
        :disabled="isGenerating || !generationForm.subjects.length || !paperTitle.trim() || !generationForm.questionTypes.length"
      >
        <span v-if="isGenerating" class="gen-spinner"/>
        {{ isGenerating ? 'Generating...' : 'Generate Paper' }}
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
          <span class="gen-result-meta">{{ generationDiagnostics.questionCount }} questions | {{ generationDiagnostics.candidateCount }} candidates | {{ generationDiagnostics.generationsRun }} generations</span>
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
        <h2><AppIcon name="sparkles" /> Auto Generate</h2>
        <p>Paper generation requires <strong>papers:write</strong> permission.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GenerationDiagnostics, GenerationFormState } from '~/types/generation'

const props = defineProps<{
  generationForm: GenerationFormState
  canWritePapers: boolean
  isGenerating: boolean
  generationError: string
  generationDiagnostics: GenerationDiagnostics | null
  availableSubjects: string[]
  availableTags: string[]
  isLoadingMeta: boolean
  metaError: string
  totalMarks: number
  paperTitle: string
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
  'update:totalMarks': [value: number]
  generate: []
}>()

const fitnessClass = computed(() => {
  if (!props.generationDiagnostics) return ''
  const f = props.generationDiagnostics.fitness
  if (f >= 0.85) return 'gen-fitness--high'
  if (f >= 0.60) return 'gen-fitness--mid'
  return 'gen-fitness--low'
})

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
    linear-gradient(135deg, rgba(118, 87, 255, 0.1), rgba(14, 165, 233, 0.05)),
    var(--color-surface);
}
.generation-card::after {
  content: "";
  position: absolute;
  inset: -60% -20% auto 35%;
  height: 180px;
  background: radial-gradient(circle, rgba(14, 165, 233, .16), transparent 68%);
  opacity: .55;
  transform: rotate(-10deg);
  animation: genGlowFloat 8s ease-in-out infinite;
  pointer-events: none;
}
.generation-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-warm));
  background-size: 200% 100%;
  animation: genBar 2.8s ease-in-out infinite;
}

.gen-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
.gen-header__text h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 850;
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
  border-radius: var(--radius);
  background: rgba(0, 184, 148, 0.1);
  border: 1px solid rgba(0, 184, 148, 0.22);
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
.gen-fitness--high .gen-fitness-value { color: var(--color-success-text); }
.gen-fitness--mid .gen-fitness-value { color: var(--color-warning); }
.gen-fitness--low .gen-fitness-value { color: var(--color-danger-text); }
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
  position: relative;
  z-index: 1;
  animation: revealUp .34s var(--ease-out) both;
}
.gen-field:nth-child(2) { animation-delay: .04s; }
.gen-field:nth-child(3) { animation-delay: .08s; }
.gen-field:nth-child(4) { animation-delay: .12s; }
.gen-action {
  position: relative;
  z-index: 1;
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
@keyframes genBar {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes genGlowFloat {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-10deg); opacity: .42; }
  50% { transform: translate3d(-18px, 14px, 0) rotate(-6deg); opacity: .72; }
}
.gen-result {
  position: relative;
  z-index: 1;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: rgba(118, 87, 255, 0.07);
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
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  animation: revealUp .32s var(--ease-out) both;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.gen-stat:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
  border-color: rgba(118, 87, 255, .3);
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
@media (max-width: 560px) {
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

@media (prefers-reduced-motion: reduce) {
  .gen-submit:not(:disabled) {
    animation: none;
  }
}
</style>
