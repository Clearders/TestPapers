<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Edit question">
          <div class="modal-head">
            <h2>Edit Question #{{ question.id }}</h2>
            <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <div class="form-row">
                <div class="form-group" style="flex:1">
                  <label class="form-label" for="edit-type">Type</label>
                  <select id="edit-type" v-model="form.type" class="form-input" required>
                    <option v-for="option in QUESTION_TYPE_OPTIONS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="form-group" style="flex:1">
                  <label class="form-label" for="edit-difficulty">Difficulty</label>
                  <select id="edit-difficulty" v-model="form.difficulty" class="form-input" required>
                    <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="form-group" style="flex:1">
                  <label class="form-label" for="edit-scoreweight">Score Weight</label>
                  <input
                    id="edit-scoreweight"
                    v-model.number="form.scoreWeight"
                    class="form-input"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.1"
                  >
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-text">Question Text</label>
                <textarea
                  id="edit-text"
                  v-model="form.text"
                  class="form-input form-textarea"
                  required
                />
              </div>

              <div v-if="isChoiceType" class="form-group">
                <label id="edit-options-label" class="form-label">Options</label>
                <div role="group" aria-labelledby="edit-options-label">
                <div v-for="(opt, index) in form.options" :key="index" class="option-row">
                  <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
                  <input v-model="form.options[index]" class="form-input" name="editOption" autocomplete="off" required >
                </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-answer">Answer</label>
                <textarea
                  v-if="!isChoiceType"
                  id="edit-answer"
                  v-model="form.answer"
                  class="form-input form-textarea form-textarea--short"
                  required
                />
                <select v-else id="edit-answer" v-model="form.answer" class="form-input" required>
                  <option value="">Select Correct Option</option>
                  <option v-for="(opt, index) in form.options" :key="index" :value="opt.trim()">
                    {{ String.fromCharCode(65 + index) }}. {{ opt.trim() }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-source">Source / Reference</label>
                <input id="edit-source" v-model="form.source" class="form-input" autocomplete="off" >
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" :disabled="isSaving">
                  {{ isSaving ? 'Saving…' : 'Save Changes' }}
                </button>
                <button type="button" class="btn btn-outline" @click="$emit('close')">Cancel</button>
              </div>

              <div v-if="errorMsg" class="status-banner status-banner--error modal-status">
                {{ errorMsg }}
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Question } from '~/types/question'
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_OPTIONS, clampScoreWeight } from '~/domain/questions'
import { apiErrorMessage } from '~/utils/apiError'

const props = defineProps<{
  question: Question
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: [question: Question]
}>()

const { updateQuestion } = useQuestionBank()
const isSaving = ref(false)
const errorMsg = ref('')

const isChoiceType = computed(() => {
  return form.type === 'single_choice' || form.type === 'multiple_choice' || form.type === 'true_false'
})

const form = reactive({
  type: props.question.type,
  difficulty: props.question.difficulty,
  scoreWeight: props.question.scoreWeight,
  text: props.question.text,
  options: [...(props.question.options || ['', '', '', ''])],
  answer: typeof props.question.answer === 'string' ? props.question.answer : props.question.answer.join(', '),
  source: props.question.source || ''
})

watch(() => props.visible, (val) => {
  if (val) {
    form.type = props.question.type
    form.difficulty = props.question.difficulty
    form.scoreWeight = props.question.scoreWeight
    form.text = props.question.text
    form.options = [...(props.question.options || ['', '', '', ''])]
    form.answer = typeof props.question.answer === 'string' ? props.question.answer : props.question.answer.join(', ')
    form.source = props.question.source || ''
    errorMsg.value = ''
  }
})

watch(() => form.type, (newType) => {
  const choiceTypes = new Set(['single_choice', 'multiple_choice', 'true_false'])
  if (choiceTypes.has(newType)) {
    if (!form.options.length || form.options.length < 4) {
      form.options = [...form.options, ...Array(4 - form.options.length).fill('')].slice(0, 4)
    }
  }
})

async function handleSubmit () {
  errorMsg.value = ''
  isSaving.value = true
  try {
    const patch: Partial<Omit<Question, 'id'>> = {
      type: form.type as Question['type'],
      difficulty: form.difficulty as Question['difficulty'],
      scoreWeight: clampScoreWeight(form.scoreWeight),
      text: form.text.trim(),
      source: form.source.trim() || undefined
    }
    if (isChoiceType.value) {
      patch.options = form.options.map(o => o.trim()).filter(Boolean)
      patch.answer = form.answer.trim()
    } else {
      patch.options = undefined
      patch.answer = form.answer.trim()
    }
    const updated = await updateQuestion(props.question.publicId, patch)
    emit('saved', updated)
    emit('close')
  } catch (err) {
    errorMsg.value = apiErrorMessage(err, 'Failed to save changes.')
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  padding: 20px;
}
.modal-panel {
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 1.3rem;
  color: var(--color-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.modal-close:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
.modal-body {
  padding: 20px;
}
.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.form-row > .form-group {
  min-width: 160px;
}
.form-textarea {
  min-height: 90px;
  resize: vertical;
}
.form-textarea--short {
  min-height: 56px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.option-label {
  width: 24px;
  font-weight: 700;
  color: var(--color-primary);
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.modal-status {
  margin-top: 12px;
}
@media (max-width: 560px) {
  .modal-panel {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    max-height: 85vh;
  }
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
}

</style>
