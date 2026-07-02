<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Temporary question edit">
          <div class="modal-head">
            <div>
              <h2>Draft Edit #{{ question.id }}</h2>
              <p>{{ question.publicId }}</p>
            </div>
            <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
          </div>

          <form class="modal-body" @submit.prevent="handleSubmit">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="temp-type">Type</label>
                <select id="temp-type" v-model="form.type" class="form-input" required>
                  <option v-for="option in QUESTION_TYPE_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="temp-difficulty">Difficulty</label>
                <select id="temp-difficulty" v-model="form.difficulty" class="form-input" required>
                  <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="temp-scoreweight">Weight</label>
                <input id="temp-scoreweight" v-model.number="form.scoreWeight" class="form-input" type="number" min="0.01" max="100" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label" for="temp-marks">Marks</label>
                <input id="temp-marks" v-model.number="form.marks" class="form-input" type="number" min="1" step="1">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group form-group--wide">
                <label class="form-label" for="temp-subjects">Subjects</label>
                <input id="temp-subjects" v-model="form.subjectsText" class="form-input" autocomplete="off">
              </div>
              <div class="form-group form-group--wide">
                <label class="form-label" for="temp-tags">Tags</label>
                <input id="temp-tags" v-model="form.tagsText" class="form-input" autocomplete="off">
              </div>
            </div>

            <div class="form-group">
              <div class="field-head">
                <label class="form-label" for="temp-text">Question Text</label>
                <button class="btn btn-outline btn-sm" type="button" @click="normalizeText">
                  <AppIcon name="sparkles" />
                  Normalize
                </button>
              </div>
              <textarea id="temp-text" v-model="form.text" class="form-input form-textarea" required />
            </div>

            <div v-if="isOptionType" class="form-group">
              <div class="field-head">
                <label id="temp-options-label" class="form-label">Options</label>
                <button class="btn btn-outline btn-sm" type="button" @click="addOption">
                  <AppIcon name="add" />
                  Add
                </button>
              </div>
              <div class="option-list" role="group" aria-labelledby="temp-options-label">
                <div v-for="(_, index) in form.options" :key="index" class="option-row">
                  <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
                  <input v-model="form.options[index]" class="form-input" name="tempOption" autocomplete="off">
                  <button class="icon-btn" type="button" :disabled="form.options.length <= 2" aria-label="Remove option" @click="removeOption(index)">
                    <AppIcon name="x" />
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="temp-answer">Answer</label>
              <textarea id="temp-answer" v-model="form.answerText" class="form-input form-textarea form-textarea--short" />
            </div>

            <div v-if="form.type === 'essay'" class="form-row">
              <div class="form-group">
                <label class="form-label" for="temp-essay-lines">Essay Lines</label>
                <input id="temp-essay-lines" v-model.number="form.essayLines" class="form-input" type="number" min="1" max="20" step="1">
              </div>
              <div class="form-group">
                <label class="form-label" for="temp-essay-lineheight">Line Height</label>
                <input id="temp-essay-lineheight" v-model.number="form.essayLineHeight" class="form-input" type="number" min="20" max="48" step="1">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="temp-source">Source / Reference</label>
              <input id="temp-source" v-model="form.source" class="form-input" autocomplete="off">
            </div>

            <div v-if="question.images?.length" class="image-strip">
              <span v-for="(image, index) in question.images" :key="index" class="tag">
                <AppIcon name="image" />
                {{ image.caption || image.url }}
              </span>
            </div>

            <div v-if="errorMsg" class="status-banner status-banner--error modal-status" aria-live="polite">
              {{ errorMsg }}
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                <AppIcon name="check" />
                Apply to Draft
              </button>
              <button v-if="question.isTemporaryEdit" type="button" class="btn btn-outline" @click="$emit('reset', question.id)">
                <AppIcon name="x" />
                Reset Draft Edit
              </button>
              <button type="button" class="btn btn-outline" @click="$emit('close')">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { PaperQuestion } from '~/domain/papers'
import type { Question, QuestionDifficulty, QuestionType } from '~/types/question'
import {
  DEFAULT_ESSAY_BLANK_SPACE,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  clampScoreWeight,
  isOptionQuestionType,
  normalizeEssayBlankSpace,
  optionalPositiveInteger
} from '~/domain/questions'

const props = defineProps<{
  question: PaperQuestion
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [question: PaperQuestion]
  reset: [id: number]
}>()

const form = reactive({
  type: props.question.type as QuestionType,
  difficulty: props.question.difficulty as QuestionDifficulty,
  scoreWeight: props.question.scoreWeight,
  marks: (props.question.marks || undefined) as number | undefined,
  subjectsText: props.question.subjects.join(', '),
  tagsText: props.question.tags.join(', '),
  text: props.question.text,
  options: [...(props.question.options || ['True', 'False'])],
  answerText: Array.isArray(props.question.answer) ? props.question.answer.join(', ') : String(props.question.answer || ''),
  source: props.question.source || '',
  essayLines: props.question.essayBlankSpace?.lines || DEFAULT_ESSAY_BLANK_SPACE.lines,
  essayLineHeight: props.question.essayBlankSpace?.lineHeight || DEFAULT_ESSAY_BLANK_SPACE.lineHeight
})
const errorMsg = ref('')

const isOptionType = computed(() => isOptionQuestionType(form.type))

watch(() => props.visible, (visible) => {
  if (visible) resetForm()
})

watch(() => form.type, (type) => {
  if (type === 'true_false' && !form.options.some(option => option.trim())) {
    form.options = ['True', 'False']
  } else if (isOptionQuestionType(type) && form.options.length < 2) {
    form.options = [...form.options, ...Array(2 - form.options.length).fill('')]
  }
})

function resetForm () {
  form.type = props.question.type
  form.difficulty = props.question.difficulty
  form.scoreWeight = props.question.scoreWeight
  form.marks = props.question.marks
  form.subjectsText = props.question.subjects.join(', ')
  form.tagsText = props.question.tags.join(', ')
  form.text = props.question.text
  form.options = [...(props.question.options || (props.question.type === 'true_false' ? ['True', 'False'] : ['', '', '', '']))]
  form.answerText = Array.isArray(props.question.answer) ? props.question.answer.join(', ') : String(props.question.answer || '')
  form.source = props.question.source || ''
  form.essayLines = props.question.essayBlankSpace?.lines || DEFAULT_ESSAY_BLANK_SPACE.lines
  form.essayLineHeight = props.question.essayBlankSpace?.lineHeight || DEFAULT_ESSAY_BLANK_SPACE.lineHeight
  errorMsg.value = ''
}

function splitList (value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function splitAnswerList (value: string) {
  return value
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeText () {
  form.text = form.text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  form.options = form.options.map(option => option.replace(/[ \t]+/g, ' ').trim())
  form.answerText = form.answerText.replace(/[ \t]+/g, ' ').trim()
}

function addOption () {
  form.options.push('')
}

function removeOption (index: number) {
  if (form.options.length <= 2) return
  form.options.splice(index, 1)
}

function detectLatex (question: Pick<Question, 'text' | 'answer'> & { options?: string[] }) {
  const answer = Array.isArray(question.answer) ? question.answer.join(' ') : question.answer
  return /\$\$?[^$]+\$\$?/.test([question.text, answer, ...(question.options || [])].join(' '))
}

function originalQuestionSnapshot (question: PaperQuestion): Question {
  return {
    id: question.id,
    publicId: question.publicId,
    type: question.type,
    subjects: [...question.subjects],
    difficulty: question.difficulty,
    tags: [...question.tags],
    text: question.text,
    ...(question.options?.length ? { options: [...question.options] } : {}),
    answer: Array.isArray(question.answer) ? [...question.answer] : question.answer,
    hasLatex: question.hasLatex,
    ...(question.source ? { source: question.source } : {}),
    ...(question.essayBlankSpace ? { essayBlankSpace: { ...question.essayBlankSpace } } : {}),
    ...(question.images?.length ? { images: question.images.map(image => ({ ...image })) } : {}),
    scoreWeight: question.scoreWeight,
    ...(typeof question.ownerId === 'number' || question.ownerId === null ? { ownerId: question.ownerId } : {})
  }
}

function handleSubmit () {
  errorMsg.value = ''
  const text = form.text.trim()
  if (!text) {
    errorMsg.value = 'Question text is required.'
    return
  }

  const options = isOptionType.value ? form.options.map(option => option.trim()).filter(Boolean) : undefined
  if (isOptionType.value && (!options || options.length < 2)) {
    errorMsg.value = 'At least two options are required.'
    return
  }

  const answer = form.type === 'multiple_choice'
    ? splitAnswerList(form.answerText)
    : form.answerText.trim()
  const nextQuestion: PaperQuestion = {
    ...props.question,
    type: form.type,
    difficulty: form.difficulty,
    scoreWeight: clampScoreWeight(form.scoreWeight),
    marks: optionalPositiveInteger(form.marks),
    subjects: splitList(form.subjectsText),
    tags: splitList(form.tagsText).map(tag => tag.toLowerCase()),
    text,
    answer,
    hasLatex: detectLatex({ text, answer, options }),
    source: form.source.trim() || undefined,
    options,
    essayBlankSpace: form.type === 'essay'
      ? normalizeEssayBlankSpace({ lines: form.essayLines, lineHeight: form.essayLineHeight })
      : undefined,
    isTemporaryEdit: true,
    originalQuestion: props.question.originalQuestion || originalQuestionSnapshot(props.question)
  }

  emit('save', nextQuestion)
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
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
}
.modal-panel {
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
}
.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-head h2 {
  font-size: 1.05rem;
  font-weight: 800;
}
.modal-head p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: .78rem;
}
.modal-close {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-muted);
  font-size: 1.3rem;
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
  flex-wrap: wrap;
  gap: 12px;
}
.form-row > .form-group {
  flex: 1 1 140px;
}
.form-group--wide {
  flex-basis: 260px;
}
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.form-textarea {
  min-height: 110px;
  resize: vertical;
}
.form-textarea--short {
  min-height: 64px;
}
.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 8px;
}
.option-label {
  color: var(--color-primary);
  font-weight: 800;
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
}
.icon-btn:disabled {
  opacity: .4;
}
.image-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.image-strip .tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.modal-status {
  margin-bottom: 12px;
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (max-width: 620px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal-panel {
    max-height: 88vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  .form-actions .btn,
  .field-head .btn {
    width: 100%;
  }
  .field-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
