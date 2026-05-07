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
                <option value="blank">Fill in the Blank</option>
                <option value="essay">Free Response</option>
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
              v-if="form.type !== 'choice'"
              v-model="form.answer"
              class="form-input form-textarea form-textarea--short"
              placeholder="e.g. $x = 4$"
              required
            />
            <select v-else v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Option</option>
              <option v-for="(opt, index) in form.options" :key="index" :value="opt.trim()">
                {{ String.fromCharCode(65 + index) }}. {{ opt.trim() }}
              </option>
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

      <div class="preview-panel">
        <div class="panel-head">
          <h2>Live Preview</h2>
        </div>

        <div class="preview-card card">
          <div class="preview-header">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <span v-if="form.difficulty" class="badge" :class="`badge-${form.difficulty}`">{{ form.difficulty }}</span>
              <span v-if="form.subject" class="tag">{{ form.subject }}</span>
              <span v-for="tag in form.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <span v-if="form.source" class="form-hint">{{ form.source }}</span>
          </div>

          <div class="preview-section">
            <span class="preview-label">Question</span>
            <div v-if="form.questionText" class="preview-content">
              <template v-for="(part, i) in parseLatexParts(form.questionText)" :key="'q' + i">
                <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                <span v-else>{{ part.content }}</span>
              </template>
            </div>
            <span v-else class="placeholder-text">Your question will appear here.</span>

            <div v-if="form.type === 'choice' && form.options.some(option => option.trim())" class="preview-options">
              <div v-for="(opt, index) in form.options" :key="'opt' + index">
                <span v-if="opt.trim()" class="preview-option">
                  <strong>{{ String.fromCharCode(65 + index) }}.</strong>
                  <span>
                    <template v-for="(part, i) in parseLatexParts(opt)" :key="'op' + i">
                      <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                      <span v-else>{{ part.content }}</span>
                    </template>
                  </span>
                </span>
              </div>
            </div>

            <div
              v-if="form.type === 'essay'"
              class="essay-preview-space"
              :style="{ minHeight: `${essayBlankHeight}px` }"
            />
          </div>

          <div v-if="form.answer" class="preview-section">
            <span class="preview-label">Answer</span>
            <div class="preview-content">
              <template v-if="form.type === 'choice'">
                <strong>{{ form.answer }}</strong>
              </template>
              <template v-else v-for="(part, i) in parseLatexParts(form.answer)" :key="'a' + i">
                <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                <span v-else>{{ part.content }}</span>
              </template>
            </div>
          </div>
        </div>

        <div class="cheatsheet card" style="margin-top:20px">
          <h3 style="margin-bottom:10px;font-size:.95rem">LaTeX Quick Reference</h3>
          <table class="cheat-table">
            <thead>
              <tr><th>Type</th><th>Syntax</th><th>Result</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in cheatSheet" :key="row.label">
                <td>{{ row.label }}</td>
                <td><code>{{ row.code }}</code></td>
                <td><LatexRenderer :formula="row.formula" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { DEFAULT_ESSAY_BLANK_SPACE } from '~/composables/useQuestionBank'

const { addQuestion } = useQuestionBank()
const { hasPermission, loadSession } = useAuth()

const tagInput = ref('')
const submitted = ref(false)
const submitError = ref('')
const isSaving = ref(false)
const canCreateQuestions = computed(() => hasPermission('questions:write'))

onMounted(() => {
  void loadSession()
})

const form = reactive({
  type: 'choice',
  subject: '',
  difficulty: '',
  tags: [] as string[],
  questionText: '',
  options: ['', '', '', ''],
  answer: '',
  source: '',
  essayBlankSpace: { ...DEFAULT_ESSAY_BLANK_SPACE }
})

watch(() => form.type, () => {
  form.answer = ''
  if (form.type === 'choice' && form.options.length !== 4) form.options = ['', '', '', '']
  if (form.type === 'essay') form.essayBlankSpace = { ...DEFAULT_ESSAY_BLANK_SPACE }
})

watch(() => form.options, () => {
  if (form.type !== 'choice') return
  if (form.answer && !form.options.includes(form.answer)) {
    form.answer = ''
  }
}, { deep: true })

const essayBlankHeight = computed(() => {
  return Math.max(1, form.essayBlankSpace.lines) * Math.max(20, form.essayBlankSpace.lineHeight)
})

function addTag () {
  const tag = tagInput.value.trim()
  if (tag && !form.tags.includes(tag)) form.tags.push(tag)
  tagInput.value = ''
}

function removeTag (tag: string) {
  form.tags = form.tags.filter(item => item !== tag)
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
      type: form.type as 'choice' | 'blank' | 'essay',
      subject: form.subject.trim(),
      difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
      tags: [...form.tags],
      text: form.questionText.trim(),
      options: form.type === 'choice'
        ? form.options.map(option => option.trim()).filter(Boolean)
        : undefined,
      answer: form.answer.trim(),
      source: form.source.trim() || undefined,
      essayBlankSpace: form.type === 'essay'
        ? {
            lines: form.essayBlankSpace.lines,
            lineHeight: form.essayBlankSpace.lineHeight
          }
        : undefined
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
  form.type = 'choice'
  form.subject = ''
  form.difficulty = ''
  form.tags = []
  form.questionText = ''
  form.options = ['', '', '', '']
  form.answer = ''
  form.source = ''
  form.essayBlankSpace = { ...DEFAULT_ESSAY_BLANK_SPACE }
  tagInput.value = ''
  if (clearBanner) submitted.value = false
}

function handleReset () {
  resetForm()
}

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
  grid-template-columns: 1fr 1fr;
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
}
.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
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
</style>
