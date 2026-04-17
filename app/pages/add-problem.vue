<template>
  <section>
    <h1 class="page-title">Add Problem </h1>
    <p class="page-sub">Compose a new problem with real-time LaTeX preview.</p>

    <div class="add-layout">
      <!-- Form -->
      <div class="form-panel">
        <form class="card" @submit.prevent="submitProblem">
          <!-- Type -->
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Type <span class="required">*</span></label>
              <select v-model="form.type" class="form-input" required>
                <option value="choice">Multiple Choice (选择题)</option>
                <option value="blank">Fill in the Blanks (填空题)</option>
                <option value="essay">Free Response (解答题)</option>
              </select>
            </div>
          </div>

          <!-- Subject & difficulty -->
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Subject <span class="required">*</span></label>
              <input v-model="form.subject" class="form-input" placeholder="e.g. Mathematics" required />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Difficulty <span class="required">*</span></label>
              <select v-model="form.difficulty" class="form-input" required>
                <option value="">Select…</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <!-- Tags -->
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
            <div class="tag-list" v-if="form.tags.length">
              <span v-for="t in form.tags" :key="t" class="tag tag-removable">
                {{ t }} <button type="button" @click="removeTag(t)">×</button>
              </span>
            </div>
            <span class="form-hint">Press Enter or click Add after each tag.</span>
          </div>

          <!-- Question text -->
          <div class="form-group">
            <label class="form-label">
              Question Text <span class="required">*</span>
              <span class="form-hint" style="margin-left:8px">Use $…$ for inline LaTeX, $$…$$ for block.</span>
            </label>
            <textarea
              v-model="form.questionText"
              class="form-input form-textarea"
              placeholder="e.g. Solve for $x$: $2x + 5 = 13$"
              required
            ></textarea>
          </div>

          <!-- Options for Multiple Choice -->
          <div class="form-group" v-if="form.type === 'choice'">
            <label class="form-label">Options <span class="required">*</span></label>
            <div v-for="(opt, index) in form.options" :key="index" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-weight: bold; width: 24px;">{{ String.fromCharCode(65 + index) }}.</span>
              <input v-model="form.options[index]" class="form-input" :placeholder="'Option ' + String.fromCharCode(65 + index)" required />
            </div>
          </div>

          <!-- Answer -->
          <div class="form-group">
            <label class="form-label">Answer <span class="required">*</span></label>
            <textarea
              v-if="form.type !== 'choice'"
              v-model="form.answer"
              class="form-input form-textarea form-textarea--short"
              placeholder="e.g. $x = 4$"
              required
            ></textarea>
            <select v-else v-model="form.answer" class="form-input" required>
              <option value="">Select Correct Option…</option>
              <option v-for="(opt, index) in form.options" :key="index" :value="String.fromCharCode(65 + index)">
                {{ String.fromCharCode(65 + index) }}
              </option>
            </select>
          </div>

          <!-- Source -->
          <div class="form-group">
            <label class="form-label">Source / Reference</label>
            <input v-model="form.source" class="form-input" placeholder="e.g. Chapter 3, Exercise 5" />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="submitted">
              {{ submitted ? '✓ Saved!' : ' Save Problem' }}
            </button>
            <button type="button" class="btn btn-outline" @click="resetForm">Reset</button>
          </div>

          <div v-if="submitted" class="success-banner">
            ✅ Problem saved successfully! <NuxtLink to="/questions">View in Question Bank →</NuxtLink>
          </div>
        </form>
      </div>

      <!-- Live preview -->
      <div class="preview-panel">
        <div class="panel-head">
          <h2>Live Preview</h2>
        </div>

        <div class="preview-card card">
          <!-- Header row -->
          <div class="preview-header">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <span
                v-if="form.difficulty"
                class="badge"
                :class="`badge-${form.difficulty}`"
              >{{ form.difficulty }}</span>
              <span v-if="form.subject" class="tag">{{ form.subject }}</span>
              <span v-for="t in form.tags" :key="t" class="tag">{{ t }}</span>
            </div>
            <span v-if="form.source" class="form-hint">{{ form.source }}</span>
          </div>

          <!-- Question preview -->
          <div class="preview-section">
            <span class="preview-label">Question</span>
            <div class="preview-content" v-if="form.questionText">
              <template v-for="(part, i) in parseParts(form.questionText)" :key="'q'+i">
                <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                <span v-else>{{ part.content }}</span>
              </template>
            </div>
            <span v-else class="placeholder-text">Your question will appear here…</span>

            <div v-if="form.type === 'choice' && form.options.some(o => o.trim())" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div v-for="(opt, index) in form.options" :key="'opt'+index">
                <span v-if="opt.trim()" style="display: flex; gap: 8px;">
                  <strong>{{ String.fromCharCode(65 + index) }}.</strong>
                  <span>
                    <template v-for="(part, i) in parseParts(opt)" :key="'op'+i">
                      <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                      <span v-else>{{ part.content }}</span>
                    </template>
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- Answer preview -->
          <div class="preview-section" v-if="form.answer">
            <span class="preview-label">Answer</span>
            <div class="preview-content">
              <template v-if="form.type === 'choice'">
                <strong>{{ form.answer }}</strong>
              </template>
              <template v-else v-for="(part, i) in parseParts(form.answer)" :key="'a'+i">
                <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                <span v-else>{{ part.content }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- LaTeX cheat sheet -->
        <div class="cheatsheet card" style="margin-top:20px">
          <h3 style="margin-bottom:10px;font-size:.95rem">LaTeX Quick Reference</h3>
          <table class="cheat-table">
            <thead>
              <tr><th>Type</th><th>Syntax</th><th>Result</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in cheatSheet" :key="r.label">
                <td>{{ r.label }}</td>
                <td><code>{{ r.code }}</code></td>
                <td><LatexRenderer :formula="r.formula" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const tagInput = ref('')
const submitted = ref(false)

const form = reactive({
  type: 'choice',
  subject: '',
  difficulty: '',
  tags: [] as string[],
  questionText: '',
  options: ['', '', '', ''],
  answer: '',
  source: ''
})

watch(() => form.type, (newType, oldType) => {
  if (newType !== oldType) {
    if (newType === 'choice') {
      form.answer = ''
    } else {
      form.answer = ''
    }
  }
})

function addTag () {
  const t = tagInput.value.trim()
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ''
}
function removeTag (t: string) { form.tags = form.tags.filter(x => x !== t) }

function submitProblem () {
  submitted.value = true
  setTimeout(() => { submitted.value = false }, 4000)
}

function resetForm () {
  form.type = 'choice'
  form.subject = ''
  form.difficulty = ''
  form.tags = []
  form.questionText = ''
  form.options = ['', '', '', '']
  form.answer = ''
  form.source = ''
  tagInput.value = ''
  submitted.value = false
}

interface Part { isLatex: boolean; content: string; block: boolean }
function parseParts (text: string): Part[] {
  const parts: Part[] = []
  if (!text) return parts
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let last = 0; let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ isLatex: false, content: text.slice(last, m.index), block: false })
    if (m[1] !== undefined) parts.push({ isLatex: true, content: m[1], block: true })
    else parts.push({ isLatex: true, content: m[2] || '', block: false })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ isLatex: false, content: text.slice(last), block: false })
  return parts
}

const cheatSheet = [
  { label: 'Fraction',   code: '\\frac{a}{b}',    formula: '\\frac{a}{b}' },
  { label: 'Square root',code: '\\sqrt{x}',        formula: '\\sqrt{x}' },
  { label: 'Power',      code: 'x^{2}',            formula: 'x^{2}' },
  { label: 'Subscript',  code: 'x_{n}',            formula: 'x_{n}' },
  { label: 'Integral',   code: '\\int_a^b f\\,dx', formula: '\\int_a^b f\\,dx' },
  { label: 'Sum',        code: '\\sum_{i=1}^n i',  formula: '\\sum_{i=1}^n i' },
  { label: 'Infinity',   code: '\\infty',           formula: '\\infty' },
  { label: 'Greek',      code: '\\alpha, \\beta',  formula: '\\alpha, \\beta' }
]
</script>

<style scoped>
.add-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 820px) { .add-layout { grid-template-columns: 1fr; } }

.form-panel .card { display: flex; flex-direction: column; gap: 0; }
.form-row { display: flex; gap: 16px; flex-wrap: wrap; }
.form-textarea { min-height: 120px; resize: vertical; font-family: monospace; transition-property: border-color, box-shadow, background-color; }
.form-textarea--short { min-height: 70px; }
.tag-input-row { display: flex; gap: 8px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.tag-removable { display: inline-flex; align-items: center; gap: 4px; }
.tag-removable button {
  background: none; border: none; cursor: pointer; font-size: .85rem;
  color: var(--color-primary); line-height: 1;
}
.form-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.required { color: var(--color-danger); }
.success-banner {
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: var(--radius); padding: 12px 16px;
  font-size: .9rem; color: #15803d; margin-top: 4px;
}
.success-banner a { color: var(--color-primary); text-decoration: underline; }

.panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.panel-head h2 { font-size: 1.05rem; font-weight: 700; }
.preview-card { display: flex; flex-direction: column; gap: 16px; }
.preview-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
.preview-section { display: flex; flex-direction: column; gap: 6px; }
.preview-label { font-size: .75rem; font-weight: 700; text-transform: uppercase; color: var(--color-muted); }
.preview-content { font-size: .95rem; line-height: 1.8; }
.placeholder-text { color: var(--color-muted); font-style: italic; font-size: .9rem; }

.cheatsheet { font-size: .85rem; }
.cheat-table { width: 100%; border-collapse: collapse; }
.cheat-table th, .cheat-table td { padding: 6px 10px; border-bottom: 1px solid var(--color-border); text-align: left; }
.cheat-table th { font-size: .78rem; text-transform: uppercase; color: var(--color-muted); }
code { background: var(--color-bg); padding: 1px 5px; border-radius: 4px; font-size: .82rem; }
</style>
