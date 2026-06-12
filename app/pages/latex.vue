<template>
  <section>
    <h1 class="page-title">Real-time LaTeX Preview</h1>
    <p class="page-sub">Type or compose LaTeX below. Rendered with a 200ms debounce for smooth performance.</p>

    <div class="latex-layout">
      <div class="input-panel">
        <div class="symbol-toolbar card">
          <button
            v-for="sym in symbols"
            :key="sym.label"
            type="button"
            class="symbol-btn"
            :aria-label="'Insert ' + sym.label"
            :title="sym.label"
            @click="insertSymbol(sym.insert)"
          >
            <LatexRenderer :formula="sym.display" />
          </button>
        </div>

        <textarea
          v-model="rawInput"
          class="form-input latex-textarea"
          placeholder="Type LaTeX here. Use $...$ for inline and $$...$$ for block formulas\u2026"
          spellcheck="false"
        />

        <div class="input-actions">
          <button type="button" class="btn btn-outline btn-sm" @click="copyPreview">Copy Rendered</button>
          <button type="button" class="btn btn-outline btn-sm" @click="clearInput">Clear</button>
        </div>

        <div class="preset-section">
          <span class="form-hint">Templates:</span>
          <button
            v-for="tmpl in templates"
            :key="tmpl.label"
            type="button"
            class="btn btn-outline btn-sm"
            @click="rawInput = tmpl.formula"
          >
            {{ tmpl.label }}
          </button>
        </div>

        <div v-if="renderError" class="status-banner status-banner--error" aria-live="polite">
          {{ renderError }}
        </div>
      </div>

      <div class="preview-panel card">
        <div class="preview-head">
          <span class="preview-label">Preview</span>
          <span v-if="dirty" class="preview-hint">Rendering\u2026</span>
        </div>
        <div v-if="latexParts.length" class="preview-content">
          <template v-for="(part, i) in latexParts" :key="i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
            <span v-else class="plain-text">{{ part.content }}</span>
          </template>
        </div>
        <span v-else class="placeholder-text">Start typing above\u2026</span>
      </div>
    </div>

    <div class="cheatsheet card">
      <h2>LaTeX Quick Reference</h2>
      <div class="cheat-scroll">
        <table class="cheat-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Syntax</th>
              <th>Result</th>
            </tr>
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
  </section>
</template>

<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import LatexRenderer from '~/components/LatexRenderer.vue'
import { parseLatexParts } from '~/composables/useLatexParts'
import { LATEX_QUICK_REFERENCE } from '~/domain/questions'

const rawInput = ref('\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}')
const debouncedInput = ref(rawInput.value)
const renderError = ref('')
const dirty = ref(false)

const debouncedSet = debounce((val: string) => {
  debouncedInput.value = val
  dirty.value = false
  renderError.value = ''
}, 200)

watch(rawInput, (val) => {
  dirty.value = val !== debouncedInput.value
  debouncedSet(val)
})

const latexParts = computed(() => {
  if (!debouncedInput.value.trim()) return []
  return parseLatexParts(debouncedInput.value)
})

const cheatSheet = LATEX_QUICK_REFERENCE

const symbols = [
  { label: 'Fraction', insert: '\\frac{}{}', display: '\\frac{a}{b}' },
  { label: 'Square root', insert: '\\sqrt{}', display: '\\sqrt{x}' },
  { label: 'Power', insert: '^{}', display: 'x^{2}' },
  { label: 'Subscript', insert: '_{}', display: 'x_{n}' },
  { label: 'Integral', insert: '\\int_{}^{}', display: '\\int_a^b' },
  { label: 'Sum', insert: '\\sum_{}^{}', display: '\\sum_{i=1}^n' },
  { label: 'Limit', insert: '\\lim_{x \\to }', display: '\\lim_{x \\to 0}' },
  { label: 'Alpha', insert: '\\alpha', display: '\\alpha' },
  { label: 'Beta', insert: '\\beta', display: '\\beta' },
  { label: 'Pi', insert: '\\pi', display: '\\pi' },
  { label: 'Infinity', insert: '\\infty', display: '\\infty' },
  { label: 'Matrix 2x2', insert: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', display: '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}' }
]

const templates = [
  { label: 'Gaussian Integral', formula: '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}' },
  { label: 'Quadratic Formula', formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: "Euler's Identity", formula: 'e^{i\\pi} + 1 = 0' },
  { label: 'Taylor Series', formula: 'e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}' },
  { label: 'Matrix', formula: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}' },
  { label: 'Multi-Formula', formula: '$x^2 + y^2 = r^2$ is the circle equation. So $$\\frac{d}{dx}\\sin x = \\cos x$$ follows.' }
]

function insertSymbol(str: string) {
  const textarea = document.querySelector('.latex-textarea') as HTMLTextAreaElement | null
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  rawInput.value = rawInput.value.slice(0, start) + str + rawInput.value.slice(end)
  nextTick(() => {
    textarea.focus()
    const cursorPos = start + str.length
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

function clearInput() {
  rawInput.value = ''
  renderError.value = ''
}

async function copyPreview() {
  try {
    await navigator.clipboard.writeText(debouncedInput.value)
  } catch {
    renderError.value = 'Failed to copy to clipboard.'
  }
}
</script>

<style scoped>
.latex-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.input-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.symbol-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
}

.symbol-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 36px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
  color: var(--color-text);
}

.symbol-btn:hover {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.06);
  transform: translateY(-1px);
}

.symbol-btn:active {
  transform: scale(0.94);
}

.latex-textarea {
  width: 100%;
  min-height: 240px;
  resize: vertical;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: .9rem;
  line-height: 1.7;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.latex-textarea:focus {
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
}

.input-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.preview-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-label {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-muted);
}

.preview-hint {
  font-size: .78rem;
  color: var(--color-muted);
  font-style: italic;
}

.preview-content {
  font-size: 1.05rem;
  line-height: 2;
  min-width: 0;
  overflow-x: auto;
  overflow-wrap: anywhere;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plain-text {
  color: var(--color-text);
  white-space: pre-wrap;
}

.placeholder-text {
  color: var(--color-muted);
  font-style: italic;
  font-size: .9rem;
}

.cheatsheet {
  margin-top: 32px;
}

.cheatsheet h2 {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.cheat-scroll {
  overflow-x: auto;
}

.cheat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}

.cheat-table th,
.cheat-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
}

.cheat-table th {
  font-size: .78rem;
  text-transform: uppercase;
  color: var(--color-muted);
  font-weight: 600;
}

code {
  background: var(--color-bg);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: .82rem;
  white-space: nowrap;
}

.status-banner--error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
  border: 1px solid;
  border-radius: var(--radius);
  padding: 10px 12px;
  font-size: .875rem;
}

[data-theme="dark"] .preview-content {
  color: var(--color-text);
}

[data-theme="dark"] .preview-content :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .symbol-toolbar :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .cheat-table :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .status-banner--error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: #fca5a5;
}

@media (max-width: 820px) {
  .latex-layout {
    grid-template-columns: 1fr;
  }

  .latex-textarea {
    min-height: 200px;
  }
}

@media (max-width: 560px) {
  .symbol-toolbar {
    padding: 8px 10px;
  }

  .symbol-btn {
    min-width: 34px;
    height: 32px;
  }

  .input-actions .btn,
  .preset-section .btn {
    width: 100%;
  }

  .cheat-table th,
  .cheat-table td {
    padding: 6px 8px;
    font-size: .78rem;
  }
}
</style>
