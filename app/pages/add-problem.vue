<template>
  <section>
    <h1 class="page-title">Add Problem</h1>
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
              <label class="form-label">Type <span class="required">*</span></label>
              <select v-model="form.type" class="form-input" required>
                <option value="choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="blank">Fill in the Blank</option>
                <option value="short_answer">Short Answer</option>
                <option value="essay">Essay</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Subject <span class="required">*</span></label>
              <input v-model="form.subject" class="form-input" placeholder="e.g. Mathematics" required />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Difficulty <span class="required">*</span></label>
              <select v-model="form.difficulty" class="form-input" required>
                <option value="">Select</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Score Weight <span class="required">*</span></label>
              <input
                v-model.number="form.scoreWeight"
                class="form-input"
                type="number"
                min="0.01"
                max="100"
                step="0.1"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tags</label>
            <div class="tag-input-row">
              <input
                v-model="tagInput"
                class="form-input"
                placeholder="Add tag and press Enter"
                @keydown.enter.prevent="addTag"
              />
              <button type="button" class="btn btn-outline btn-sm" @click="addTag">Add</button>
            </div>
            <div v-if="form.tags.length" class="tag-list">
              <span v-for="tag in form.tags" :key="tag" class="tag tag-removable">
                {{ tag }} <button type="button" @click="removeTag(tag)">x</button>
              </span>
            </div>
            <span class="form-hint">Press Enter or click Add after each tag.</span>
          </div>

          <div class="form-group">
            <label class="form-label">
              Question Text <span class="required">*</span>
              <span class="form-hint" style="margin-left:8px">Use `$...$` for inline LaTeX and `$$...$$` for block LaTeX.</span>
            </label>
            <textarea
              v-model="form.questionText"
              class="form-input form-textarea"
              placeholder="e.g. Solve for $x$: $2x + 5 = 13$"
              required
            />
          </div>

          <div v-if="form.type === 'choice'" class="form-group">
            <label class="form-label">Options <span class="required">*</span></label>
            <div v-for="(opt, index) in form.options" :key="index" class="option-row">
              <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
              <input v-model="form.options[index]" class="form-input" :placeholder="'Option ' + String.fromCharCode(65 + index)" required />
            </div>
          </div>

          <div v-if="form.type === 'true_false'" class="form-group">
            <label class="form-label">Options <span class="required">*</span></label>
            <div class="option-row">
              <span class="option-label">A.</span>
              <input :value="form.options[0]" class="form-input" disabled placeholder="True" />
            </div>
            <div class="option-row">
              <span class="option-label">B.</span>
              <input :value="form.options[1]" class="form-input" disabled placeholder="False" />
            </div>
          </div>

          <QuestionImageUploader
            v-model:images="form.images"
            :uploading="uploadingImage"
            @select="handleImageSelected"
            @remove="removeImage"
          />

          <div v-if="form.type === 'essay'" class="form-group">
            <label class="form-label">Essay Blank Space</label>
            <div class="form-row">
              <div class="form-group compact-field">
                <label class="form-label form-label--sub">Lines</label>
                <input
                  v-model.number="form.essayBlankSpace.lines"
                  class="form-input"
                  type="number"
                  min="1"
                  max="20"
                />
              </div>
              <div class="form-group compact-field">
                <label class="form-label form-label--sub">Line Height (px)</label>
                <input
                  v-model.number="form.essayBlankSpace.lineHeight"
                  class="form-input"
                  type="number"
                  min="20"
                  max="48"
                />
              </div>
            </div>
            <span class="form-hint">This controls the reserved writing area in the exported preview.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Answer <span class="required">*</span></label>
            <textarea
              v-if="form.type !== 'choice' && form.type !== 'true_false'"
              v-model="form.answer"
              class="form-input form-textarea form-textarea--short"
              placeholder="e.g. $x = 4$"
              required
            />
            <select v-else-if="form.type === 'choice'" v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Option</option>
              <option v-for="(opt, index) in form.options" :key="index" :value="opt.trim()">
                {{ String.fromCharCode(65 + index) }}. {{ opt.trim() }}
              </option>
            </select>
            <select v-else v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Answer</option>
              <option value="True">True</option>
              <option value="False">False</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Source / Reference</label>
            <input v-model="form.source" class="form-input" placeholder="e.g. Chapter 3, Exercise 5" />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="submitted || isSaving">
              {{ isSaving ? 'Saving...' : submitted ? 'Saved' : 'Save Problem' }}
            </button>
            <button type="button" class="btn btn-outline" @click="handleReset">Reset</button>
          </div>

          <div v-if="submitError" class="success-banner" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c">
            {{ submitError }}
          </div>

          <div v-if="submitted" class="success-banner">
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
import { DEFAULT_ESSAY_BLANK_SPACE, getEssayBlankHeightPx, type QuestionImage } from '~/composables/useQuestionBank'

definePageMeta({
  requiresAuth: true,
  permissions: ['questions:write']
})

const { addQuestion, uploadImage } = useQuestionBank()
const { hasPermission } = useAuth()

const tagInput = ref('')
const submitted = ref(false)
const submitError = ref('')
const isSaving = ref(false)
const uploadingImage = ref(false)
const canCreateQuestions = computed(() => hasPermission('questions:write'))

const form = reactive({
  type: 'choice' as 'choice' | 'true_false' | 'blank' | 'short_answer' | 'essay',
  subject: '',
  difficulty: '' as '' | 'easy' | 'medium' | 'hard',
  tags: [] as string[],
  questionText: '',
  options: ['', '', '', ''] as string[],
  answer: '',
  source: '',
  essayBlankSpace: { ...DEFAULT_ESSAY_BLANK_SPACE },
  scoreWeight: 1,
  images: [] as QuestionImage[]
})

watch(() => form.type, () => {
  form.answer = ''
  if (form.type === 'choice' && form.options.length !== 4) form.options = ['', '', '', '']
  if (form.type === 'true_false') form.options = ['True', 'False']
  if (form.type === 'essay') form.essayBlankSpace = { ...DEFAULT_ESSAY_BLANK_SPACE }
})

// Only watch for option changes in choice mode - shallow watch on joined options
watch(
  () => form.type === 'choice' ? form.options.join('\0') : null,
  (joined) => {
    if (joined === null) return
    if (form.answer && !form.options.includes(form.answer)) {
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

async function handleImageSelected (event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    form.images.push({ url, caption: '' })
  } catch {
    submitError.value = 'Failed to upload image.'
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
  isSaving.value = true

  try {
    await addQuestion({
      type: form.type,
      subject: form.subject.trim(),
      difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
      tags: [...form.tags],
      text: form.questionText.trim(),
      options: (form.type === 'choice' || form.type === 'true_false')
        ? form.options.map(option => option.trim()).filter(Boolean)
        : undefined,
      answer: form.answer.trim(),
      source: form.source.trim() || undefined,
      scoreWeight: Math.max(0.01, Math.min(100, Number(form.scoreWeight) || 1)),
      essayBlankSpace: form.type === 'essay'
        ? {
            lines: form.essayBlankSpace.lines,
            lineHeight: form.essayBlankSpace.lineHeight
          }
        : undefined,
      images: form.images
    })

    submitted.value = true
    setTimeout(() => { submitted.value = false }, 4000)
    resetForm(false)
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to save problem.'
  } finally {
    isSaving.value = false
  }
}

function resetForm (clearBanner = true) {
  Object.assign(form, {
    type: 'choice',
    subject: '',
    difficulty: '',
    tags: [],
    questionText: '',
    options: ['', '', '', ''],
    answer: '',
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

// Module-level constant - never changes, no need for computed
const cheatSheet = [
  { label: 'Fraction', code: '\\frac{a}{b}', formula: '\\frac{a}{b}' },
  { label: 'Square root', code: '\\sqrt{x}', formula: '\\sqrt{x}' },
  { label: 'Power', code: 'x^{2}', formula: 'x^{2}' },
  { label: 'Subscript', code: 'x_{n}', formula: 'x_{n}' },
  { label: 'Integral', code: '\\int_a^b f\\,dx', formula: '\\int_a^b f\\,dx' },
  { label: 'Sum', code: '\\sum_{i=1}^n i', formula: '\\sum_{i=1}^n i' },
  { label: 'Infinity', code: '\\infty', formula: '\\infty' },
  { label: 'Greek', code: '\\alpha, \\beta', formula: '\\alpha, \\beta' }
]
</script>

<style scoped>
.add-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
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
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
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
