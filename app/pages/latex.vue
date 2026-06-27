<template>
  <section class="latex-page">
    <h1 class="page-title"><AppIcon name="latex" /> LaTeX Preview</h1>
    <p class="page-sub">Type a single LaTeX expression and see it rendered in real time.</p>

    <div class="latex-layout">
      <div class="input-side">
        <div ref="symbolStripEl" class="symbol-strip">
          <button
            v-for="sym in symbols"
            :key="sym.label"
            type="button"
            class="symbol-chip"
            :aria-label="'Insert ' + sym.label"
            :title="sym.label"
            @click="insertSymbol(sym.insert)"
          >
            <LatexRenderer :formula="sym.display" />
          </button>
        </div>

        <textarea
          ref="inputEl"
          v-model="rawInput"
          class="latex-input"
          placeholder="e.g. \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}\u2026"
          spellcheck="false"
          wrap="soft"
          aria-label="LaTeX input"
          @pointerdown="startPreviewResizeTracking"
        />

        <div class="input-row">
          <button type="button" class="btn btn-outline btn-sm" @click="copyPreview">
            <AppIcon name="paper" />
            Copy
          </button>
          <button type="button" class="btn btn-outline btn-sm" @click="clearInput">
            <AppIcon name="x" />
            Clear
          </button>
          <span class="template-divider"/>
          <button
            v-for="tmpl in templates"
            :key="tmpl.label"
            type="button"
            class="template-link"
            @click="rawInput = tmpl.formula"
          >
            {{ tmpl.label }}
          </button>
        </div>

        <div v-if="renderError" class="status-banner status-banner--error" aria-live="polite">
          {{ renderError }}
        </div>
      </div>

      <div class="preview-side" :style="{ marginTop: previewOffset }">
        <div class="preview-stage" :class="{ 'is-stale': dirty }" :style="{ height: previewHeight }">
          <LatexRenderer v-if="debouncedInput" :formula="debouncedInput" :block="true" />
          <span v-else class="preview-placeholder">Start typing to preview\u2026</span>
        </div>
      </div>
    </div>

    <div class="reference-section">
      <h2 class="reference-title">Quick Reference</h2>
      <div class="reference-scroll">
        <table class="reference-table">
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
import LatexRenderer from '~/components/LatexRenderer.vue'
import { LATEX_QUICK_REFERENCE } from '~/domain/questions'

useSeoMeta({
  title: 'LaTeX Preview',
  description: 'A quick sandbox for typing and previewing LaTeX expressions in real time. Test your math syntax with instant rendering.'
})

const rawInput = ref('\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}')
const debouncedInput = ref(rawInput.value)
const renderError = ref('')
const dirty = ref(false)
const inputEl = shallowRef<HTMLTextAreaElement | null>(null)
const symbolStripEl = shallowRef<HTMLElement | null>(null)
const previewHeight = ref('285px')
const previewOffset = ref('0px')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let resizeTrackingFrame: number | null = null

function scheduleRender(val: string) {
  dirty.value = val !== debouncedInput.value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedInput.value = val
    dirty.value = false
    renderError.value = ''
  }, 200)
}

watch(rawInput, (val) => {
  scheduleRender(val)
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
  { label: 'Matrix 2\u00d72', insert: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', display: '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}' }
]

const templates = [
  { label: 'Gaussian', formula: '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}' },
  { label: 'Quadratic', formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: "Euler's", formula: 'e^{i\\pi} + 1 = 0' },
  { label: 'Series', formula: 'e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}' },
  { label: 'Matrix', formula: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}' },
  { label: 'Limit', formula: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' }
]

function insertSymbol(str: string) {
  const textarea = inputEl.value
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

function clearInput () {
  rawInput.value = ''
  renderError.value = ''
}

async function copyPreview () {
  try {
    await navigator.clipboard.writeText(debouncedInput.value)
  } catch {
    renderError.value = 'Failed to copy to clipboard.'
  }
}

function syncPreviewHeight () {
  const textarea = inputEl.value
  if (!textarea) return
  const minHeight = window.matchMedia('(max-width: 820px)').matches ? 200 : 285
  previewHeight.value = `${Math.max(textarea.getBoundingClientRect().height, minHeight)}px`
}

function syncPreviewOffset () {
  const symbolStrip = symbolStripEl.value
  if (!symbolStrip || window.matchMedia('(max-width: 820px)').matches) {
    previewOffset.value = '0px'
    return
  }
  const inputSide = symbolStrip.closest('.input-side')
  const gap = inputSide ? Number.parseFloat(getComputedStyle(inputSide).rowGap) || 0 : 0
  previewOffset.value = `${symbolStrip.getBoundingClientRect().height + gap}px`
}

function syncPreviewLayout () {
  syncPreviewHeight()
  syncPreviewOffset()
}

function stopPreviewResizeTracking () {
  if (resizeTrackingFrame !== null) {
    cancelAnimationFrame(resizeTrackingFrame)
    resizeTrackingFrame = null
  }
  window.removeEventListener('pointerup', stopPreviewResizeTracking)
  window.removeEventListener('blur', stopPreviewResizeTracking)
}

function trackPreviewResize () {
  syncPreviewLayout()
  resizeTrackingFrame = requestAnimationFrame(trackPreviewResize)
}

function startPreviewResizeTracking () {
  stopPreviewResizeTracking()
  window.addEventListener('pointerup', stopPreviewResizeTracking, { once: true })
  window.addEventListener('blur', stopPreviewResizeTracking, { once: true })
  resizeTrackingFrame = requestAnimationFrame(trackPreviewResize)
}

onMounted(() => {
  syncPreviewLayout()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(syncPreviewLayout)
    if (inputEl.value) resizeObserver.observe(inputEl.value)
    if (symbolStripEl.value) resizeObserver.observe(symbolStripEl.value)
  }
  window.addEventListener('resize', syncPreviewLayout)
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  stopPreviewResizeTracking()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', syncPreviewLayout)
})
</script>

<style scoped>
.latex-page {
  --preview-bg: #fafbfc;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title svg {
  color: var(--color-primary);
}

[data-theme="dark"] .latex-page {
  --preview-bg: #162032;
}

.latex-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.49fr);
  gap: 32px;
  align-items: start;
  width: min(1468px, calc(100vw - var(--site-gutter)));
}

.input-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  animation: revealLeft 0.54s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}

.symbol-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
}
.symbol-strip .symbol-chip {
  animation: symbolIn .28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.symbol-strip .symbol-chip:nth-child(2n) { animation-delay: .03s; }
.symbol-strip .symbol-chip:nth-child(3n) { animation-delay: .06s; }
.symbol-strip .symbol-chip:nth-child(4n) { animation-delay: .09s; }

.symbol-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 32px;
  padding: 1px 7px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  color: var(--color-text);
  font-size: .85rem;
}

.symbol-chip:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.symbol-chip:active {
  transform: scale(0.93);
}

.latex-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 285px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: .92rem;
  line-height: 1.75;
  resize: vertical;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.latex-input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.12);
}

.input-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.template-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 2px;
}

.template-link {
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: .78rem;
  font-weight: 500;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.15s ease;
  white-space: nowrap;
}

.template-link:hover {
  color: var(--color-primary);
  animation: templateNudge .24s ease;
}

.preview-side {
  position: sticky;
  top: calc(var(--header-h, 60px) + 20px);
  min-width: 0;
  animation: revealRight 0.54s cubic-bezier(0.16, 1, 0.3, 1) 0.14s both;
}

.preview-stage {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 285px;
  padding: 40px 32px;
  border-radius: var(--radius);
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--preview-bg);
  border: 1px solid var(--color-border);
  overflow-x: hidden;
  overflow-y: auto;
  transition: opacity 0.2s ease, transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  animation: previewGlow 4.8s ease-in-out infinite;
}
.preview-stage:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
  border-color: rgba(118, 87, 255, 0.32);
}

.preview-stage.is-stale {
  opacity: 0.5;
}

.preview-stage :deep(.katex-display) {
  margin: 0;
  max-width: 100%;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.preview-stage :deep(.katex) {
  max-width: 100%;
  font-size: 1.5rem;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.preview-stage :deep(.latex-block) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  white-space: normal;
}

.preview-stage :deep(.katex-html) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.preview-stage :deep(.katex-html > .base) {
  display: inline;
  white-space: normal;
}

.preview-placeholder {
  margin-inline: auto;
  align-self: center;
  color: var(--color-muted);
  font-size: 1rem;
  user-select: none;
}

.reference-section {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 24px;
  animation: revealUp 0.54s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both;
}

.reference-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--color-muted);
}

.reference-scroll {
  overflow-x: auto;
}

.reference-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}

.reference-table th,
.reference-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
  transition: background .18s ease, transform .18s ease;
}
.reference-table tbody tr:hover td {
  background: rgba(118, 87, 255, 0.06);
}

.reference-table th {
  font-size: .75rem;
  text-transform: uppercase;
  color: var(--color-muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}

code {
  background: var(--color-bg);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  font-size: .82rem;
  white-space: nowrap;
  transition: background .18s ease, color .18s ease;
}

@keyframes symbolIn {
  from { opacity: 0; transform: translateY(8px) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes templateNudge {
  50% { transform: translateY(-1px); }
}
@keyframes previewGlow {
  0%, 100% { box-shadow: 0 0 0 rgba(118, 87, 255, 0); }
  50% { box-shadow: 0 14px 34px rgba(118, 87, 255, 0.12); }
}

.status-banner--error {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger-text);
  border: 1px solid;
  border-radius: var(--radius);
  padding: 10px 12px;
  font-size: .875rem;
}

[data-theme="dark"] .preview-stage :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .symbol-strip :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .reference-table :deep(.katex) {
  color: var(--color-text);
}

[data-theme="dark"] .status-banner--error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: var(--color-danger-text);
}

@media (max-width: 820px) {
  .latex-layout {
    grid-template-columns: 1fr;
    gap: 20px;
    width: 100%;
  }

  .preview-side {
    position: static;
    order: -1;
  }

  .preview-stage {
    min-height: 200px;
    padding: 28px 20px;
  }

  .preview-stage :deep(.katex) {
    font-size: 1.2rem;
  }

  .latex-input {
    min-height: 200px;
  }
}

@media (max-width: 560px) {
  .symbol-strip {
    gap: 3px;
  }

  .symbol-chip {
    min-width: 32px;
    min-height: 30px;
    padding: 1px 5px;
    font-size: .8rem;
  }

  .input-row .btn {
    flex: 1;
  }

  .template-divider {
    display: none;
  }

  .reference-table th,
  .reference-table td {
    padding: 6px 8px;
    font-size: .78rem;
  }
}
</style>
