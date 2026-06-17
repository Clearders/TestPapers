<template>
  <section>
    <h1 class="page-title"><AppIcon name="edit" /> Add Problem</h1>
    <p class="page-sub">Compose a new problem with real-time LaTeX preview.</p>

    <div v-if="!canCreateQuestions" class="card permission-card">
      <h2>Permission required</h2>
      <p>You need the questions:write permission to create new problems.</p>
      <NuxtLink to="/login" class="btn btn-primary">Login</NuxtLink>
    </div>

    <div v-else class="add-layout">
      <div class="form-panel">
        <form class="card" @submit.prevent="submitProblem">
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="problem-type">Type <span class="required">*</span></label>
              <select id="problem-type" v-model="form.type" class="form-input" required>
                <option v-for="option in QUESTION_TYPE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="problem-subject">Subjects <span class="required">*</span></label>
              <div class="tag-input-row">
                <input
                  id="problem-subject"
                  v-model="subjectInput"
                  class="form-input"
                  placeholder="Add subject and press Enter…"
                  list="subject-suggestions"
                  autocomplete="off"
                  @keydown.enter.prevent="addSubject"
                />
                <datalist id="subject-suggestions">
                  <option v-for="sub in availableSubjects" :key="sub" :value="sub" />
                </datalist>
                <button type="button" class="btn btn-outline btn-sm" @click="addSubject">Add</button>
              </div>
              <div v-if="form.subjects.length" class="tag-list">
                <span v-for="sub in form.subjects" :key="sub" class="subject-pill-form subject-pill-form-removable">
                  {{ sub }} <button type="button" aria-label="Remove subject" @click="removeSubject(sub)">x</button>
                </span>
              </div>
              <span class="form-hint">Press Enter or click Add after each subject.</span>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="problem-difficulty">Difficulty <span class="required">*</span></label>
              <select id="problem-difficulty" v-model="form.difficulty" class="form-input" required>
                <option value="">Select</option>
                <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="problem-scoreweight">Score Weight <span class="required">*</span></label>
              <input
                id="problem-scoreweight"
                v-model.number="form.scoreWeight"
                class="form-input"
                type="number"
                autocomplete="off"
                min="0.01"
                max="100"
                step="0.1"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="problem-tags">Tags</label>
            <div class="tag-input-row">
              <input
                id="problem-tags"
                v-model="tagInput"
                class="form-input"
                name="problemTags"
                autocomplete="off"
                placeholder="Add tag and press Enter…"
                @keydown.enter.prevent="addTag"
              />
              <button type="button" class="btn btn-outline btn-sm" @click="addTag">Add</button>
            </div>
            <div v-if="form.tags.length" class="tag-list">
              <span v-for="tag in form.tags" :key="tag" class="tag tag-removable">
                {{ tag }} <button type="button" aria-label="Remove tag" @click="removeTag(tag)">x</button>
              </span>
            </div>
            <span class="form-hint">Press Enter or click Add after each tag.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="problem-text">
              Question Text <span class="required">*</span>
              <span class="form-hint" style="margin-left:8px">Use `$...$` for inline LaTeX and `$$...$$` for block LaTeX.</span>
            </label>
            <textarea
              id="problem-text"
              v-model="form.text"
              class="form-input form-textarea"
              spellcheck="false"
              placeholder="e.g. Solve for $x$: $2x + 5 = 13$…"
              required
            />
          </div>

          <div v-if="form.type === 'single_choice' || form.type === 'multiple_choice'" class="form-group">
            <label class="form-label" id="options-label">Options <span class="required">*</span></label>
            <div role="group" aria-labelledby="options-label">
            <div v-for="(opt, index) in form.options" :key="index" class="option-row">
              <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
              <input v-model="form.options[index]" class="form-input" name="optionText" autocomplete="off" :placeholder="'Option ' + String.fromCharCode(65 + index)" required />
            </div>
            </div>
          </div>

          <div v-if="form.type === 'true_false'" class="form-group">
            <label class="form-label" id="tf-options-label">Options <span class="required">*</span></label>
            <div role="group" aria-labelledby="tf-options-label">
            <div class="option-row">
              <span class="option-label">A.</span>
              <input :value="form.options[0]" class="form-input" disabled placeholder="True" />
            </div>
            <div class="option-row">
              <span class="option-label">B.</span>
              <input :value="form.options[1]" class="form-input" disabled placeholder="False" />
            </div>
            </div>
          </div>

          <QuestionImageUploader
            v-model:images="form.images"
            :uploading="uploadingImage"
            @select="handleImageSelected"
            @remove="removeImage"
          />

          <div v-if="form.type === 'essay'" class="form-group">
            <label class="form-label" id="essay-blank-label">Essay Blank Space</label>
            <div class="form-row" aria-labelledby="essay-blank-label" role="group">
              <div class="form-group compact-field">
                <label class="form-label form-label--sub" for="essay-lines">Lines</label>
                <input
                  id="essay-lines"
                  v-model.number="form.essayBlankSpace.lines"
                  class="form-input"
                  name="essayLines"
                  type="number"
                  min="1"
                  max="20"
                />
              </div>
              <div class="form-group compact-field">
                <label class="form-label form-label--sub" for="essay-lineheight">Line Height (px)</label>
                <input
                  id="essay-lineheight"
                  v-model.number="form.essayBlankSpace.lineHeight"
                  class="form-input"
                  name="essayLineHeight"
                  type="number"
                  min="20"
                  max="48"
                />
              </div>
            </div>
            <span class="form-hint">This controls the reserved writing area in the exported preview.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="problem-answer">Answer <span class="required">*</span></label>
            <textarea
              v-if="!usesOptionAnswers"
              id="problem-answer"
              v-model="form.answer"
              class="form-input form-textarea form-textarea--short"
              placeholder="e.g. $x = 4$…"
              required
            />
            <select v-else-if="form.type === 'single_choice'" id="problem-answer" v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Option</option>
              <option v-for="(opt, index) in form.options" :key="index" :value="opt.trim()">
                {{ String.fromCharCode(65 + index) }}. {{ opt.trim() }}
              </option>
            </select>
            <div v-else-if="form.type === 'multiple_choice'" class="form-group">
              <div v-for="(opt, index) in form.options" :key="index" class="option-row">
                <label class="checkbox-option">
                  <input type="checkbox" :value="opt.trim()" v-model="form.answerMultiple" />
                  <span>{{ String.fromCharCode(65 + index) }}. {{ opt.trim() }}</span>
                </label>
              </div>
            </div>
            <select v-else id="problem-answer" v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Answer</option>
              <option value="True">True</option>
              <option value="False">False</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="problem-source">Source / Reference</label>
            <input id="problem-source" v-model="form.source" class="form-input" placeholder="e.g. Chapter 3, Exercise 5…" autocomplete="off" />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="submitted || isSaving">
              <AppIcon v-if="!isSaving && !submitted" name="upload" />
              {{ isSaving ? 'Saving…' : submitted ? 'Saved' : 'Save Problem' }}
            </button>
            <button type="button" class="btn btn-outline" @click="handleReset">
              <AppIcon name="x" />
              Reset
            </button>
          </div>

          <div v-if="submitError" class="success-banner success-banner--error" role="alert" aria-live="polite">
            {{ submitError }}
          </div>

          <div v-if="submitted" class="success-banner" role="status" aria-live="polite">
            Problem saved successfully. <NuxtLink to="/questions">Open the workspace</NuxtLink>
          </div>
        </form>
      </div>

      <AddProblemPreview
        :form="form"
        :essay-blank-height="essayBlankHeight"
        :cheat-sheet="cheatSheet"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import AddProblemPreview from '~/components/questions/AddProblemPreview.vue'
import QuestionImageUploader from '~/components/questions/QuestionImageUploader.vue'
import type { QuestionDifficulty, QuestionImage, QuestionType } from '~/types/question'
import {
  DEFAULT_ESSAY_BLANK_SPACE,
  DIFFICULTY_OPTIONS,
  LATEX_QUICK_REFERENCE,
  QUESTION_TYPE_OPTIONS,
  clampScoreWeight,
  getEssayBlankHeightPx,
  isOptionQuestionType
} from '~/domain/questions'

definePageMeta({
  requiresAuth: true,
  permissions: ['questions:write']
})

useSeoMeta({
  title: 'Add Problem',
  description: 'Compose a new problem with live LaTeX preview. Choose from multiple question types and difficulty levels.',
  robots: 'noindex, nofollow'
})

const { addQuestion, uploadImage, availableSubjects, loadMeta } = useQuestionBank()
const { hasPermission } = useAuth()

const tagInput = ref('')
const subjectInput = ref('')
const submitted = ref(false)
const submittedTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const submitError = ref('')
const isSaving = ref(false)
const uploadingImage = ref(false)
const canCreateQuestions = computed(() => hasPermission('questions:write'))

onMounted(() => {
  void loadMeta()
})

const form = reactive({
  type: 'single_choice' as QuestionType,
  subjects: [] as string[],
  difficulty: 'medium' as QuestionDifficulty,
  tags: [] as string[],
  text: '',
  options: ['', '', '', ''] as string[],
  answer: '',
  answerMultiple: [] as string[],
  source: '',
  essayBlankSpace: { ...DEFAULT_ESSAY_BLANK_SPACE },
  scoreWeight: 1,
  images: [] as QuestionImage[]
})

const usesOptionAnswers = computed(() => isOptionQuestionType(form.type))

const isChoiceType = computed(() => form.type === 'single_choice' || form.type === 'multiple_choice')

watch(() => form.type, () => {
  form.answer = ''
  form.answerMultiple = []
  if (isChoiceType.value && form.options.length !== 4) form.options = ['', '', '', '']
  if (form.type === 'true_false') form.options = ['True', 'False']
  if (form.type === 'essay') form.essayBlankSpace = { ...DEFAULT_ESSAY_BLANK_SPACE }
})

watch(
  () => isChoiceType.value ? form.options.join('\0') : null,
  (joined) => {
    if (joined === null) return
    if (typeof form.answer === 'string' && form.answer && !form.options.includes(form.answer)) {
      form.answer = ''
    }
  }
)

const essayBlankHeight = computed(() => {
  return getEssayBlankHeightPx(form.essayBlankSpace)
})

function addTag () {
  const tag = tagInput.value.trim()
  if (tag && !form.tags.includes(tag)) form.tags.push(tag)
  tagInput.value = ''
}

function removeTag (tag: string) {
  const index = form.tags.indexOf(tag)
  if (index !== -1) form.tags.splice(index, 1)
}

function addSubject () {
  const sub = subjectInput.value.trim()
  if (sub && !form.subjects.includes(sub)) form.subjects.push(sub)
  subjectInput.value = ''
}

function removeSubject (sub: string) {
  const index = form.subjects.indexOf(sub)
  if (index !== -1) form.subjects.splice(index, 1)
}

async function handleImageSelected (event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    form.images.push({ url, caption: '' })
  } catch (error: any) {
    const errorBody = error?.data?.error
    submitError.value = (typeof errorBody === 'object' && errorBody?.message) || (error instanceof Error ? error.message : 'Failed to upload image.')
  } finally {
    uploadingImage.value = false
  }
}

function removeImage (index: number) {
  form.images.splice(index, 1)
}

async function submitProblem () {
  submitError.value = ''
  if (!canCreateQuestions.value) {
    submitError.value = 'You do not have permission to create questions.'
    return
  }
  if (!form.subjects.length) {
    submitError.value = 'Please add at least one subject.'
    return
  }
  isSaving.value = true

  try {
    await addQuestion({
      type: form.type,
      subjects: [...form.subjects],
      difficulty: form.difficulty as QuestionDifficulty,
      tags: [...form.tags],
      text: form.text.trim(),
      options: usesOptionAnswers.value
        ? form.options.map(option => option.trim()).filter(Boolean)
        : undefined,
      answer: form.type === 'multiple_choice'
        ? form.answerMultiple.filter(Boolean)
        : form.answer.trim(),
      source: form.source.trim() || undefined,
      scoreWeight: clampScoreWeight(form.scoreWeight),
      essayBlankSpace: form.type === 'essay'
        ? {
            lines: form.essayBlankSpace.lines,
            lineHeight: form.essayBlankSpace.lineHeight
          }
        : undefined,
      images: form.images
    })

    submitted.value = true
    if (submittedTimer.value) clearTimeout(submittedTimer.value)
    submittedTimer.value = setTimeout(() => { submitted.value = false }, 4000)
    resetForm(false)
  } catch (error: any) {
    const errorBody = error?.data?.error
    submitError.value = (typeof errorBody === 'object' && errorBody?.message) || (error instanceof Error ? error.message : 'Failed to save problem.')
  } finally {
    isSaving.value = false
  }
}

function resetForm (clearBanner = true) {
  Object.assign(form, {
    type: 'single_choice',
    subjects: [],
    difficulty: 'medium',
    tags: [],
    text: '',
    options: ['', '', '', ''],
    answer: '',
    answerMultiple: [],
    source: '',
    essayBlankSpace: { ...DEFAULT_ESSAY_BLANK_SPACE },
    scoreWeight: 1,
    images: []
  })
  tagInput.value = ''
  if (clearBanner) submitted.value = false
}

function handleReset () {
  resetForm()
}

onUnmounted(() => {
  if (submittedTimer.value) clearTimeout(submittedTimer.value)
})

// Module-level constant - never changes, no need for computed
const cheatSheet = LATEX_QUICK_REFERENCE
</script>

<style scoped>
.add-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title svg {
  color: var(--color-primary);
}
@media (max-width: 820px) {
  .add-layout {
    grid-template-columns: 1fr;
  }
}

.form-panel .card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.07), rgba(14, 165, 233, 0.03)),
    var(--color-surface);
}
.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.form-row > .form-group {
  min-width: 180px;
}
.compact-field {
  flex: 1;
  min-width: 150px;
  margin-bottom: 0;
}
.form-label--sub {
  color: var(--color-muted);
  font-size: .8rem;
}
.form-textarea {
  min-height: 120px;
  resize: vertical;
  font-family: monospace;
}
.form-textarea--short {
  min-height: 70px;
}
.tag-input-row,
.form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.tag-removable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tag-removable button {
  background: none;
  border: none;
  color: var(--color-primary);
  line-height: 1;
}
.subject-pill-form {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.12);
  color: var(--color-primary);
}
.subject-pill-form-removable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.subject-pill-form-removable button {
  background: none;
  border: none;
  color: var(--color-primary);
  line-height: 1;
}
.required {
  color: var(--color-danger);
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
}
.success-banner {
  background: rgba(0, 184, 148, 0.1);
  border: 1px solid rgba(0, 184, 148, 0.22);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: .9rem;
  color: #15803d;
  margin-top: 8px;
}
.success-banner a {
  color: var(--color-primary);
  text-decoration: underline;
}

.success-banner--error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

[data-theme="dark"] .success-banner {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.2);
  color: #86efac;
}

[data-theme="dark"] .success-banner--error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: #fca5a5;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.panel-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.preview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preview-label {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-muted);
}
.preview-content {
  font-size: .95rem;
  line-height: 1.8;
}
.placeholder-text {
  color: var(--color-muted);
  font-style: italic;
  font-size: .9rem;
}
.preview-options {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-option {
  display: flex;
  gap: 8px;
}
.essay-preview-space {
  margin-top: 14px;
}
.cheatsheet {
  font-size: .85rem;
  overflow-x: auto;
}
.cheat-table {
  width: 100%;
  border-collapse: collapse;
}
.cheat-table th,
.cheat-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
.cheat-table th {
  font-size: .78rem;
  text-transform: uppercase;
  color: var(--color-muted);
}
code {
  background: var(--color-bg);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: .82rem;
}
.permission-card {
  max-width: 520px;
}
.permission-card h2 {
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.permission-card p {
  color: var(--color-muted);
  margin-bottom: 16px;
}
@media (min-width: 1440px) {
  .add-layout {
    grid-template-columns: minmax(0, 1.08fr) minmax(420px, .92fr);
  }
}
@media (max-width: 620px) {
  .form-row > .form-group,
  .compact-field {
    min-width: 100%;
  }

  .tag-input-row,
  .form-actions,
  .option-row {
    align-items: stretch;
    flex-direction: column;
  }

  .tag-input-row .btn,
  .form-actions .btn {
    width: 100%;
  }

  .option-label {
    width: auto;
  }
}
</style>
