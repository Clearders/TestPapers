<template>
  <div class="preview-panel">
    <div class="panel-head">
      <h2><AppIcon name="eye" /> Live Preview</h2>
    </div>

    <div class="preview-card card">
      <div class="preview-header">
        <div class="preview-meta">
          <span v-if="form.difficulty" class="badge" :class="`badge-${form.difficulty}`">{{ form.difficulty }}</span>
          <span v-for="sub in form.subjects" :key="sub" class="subject-pill">{{ sub }}</span>
          <span class="tag">weight {{ form.scoreWeight }}</span>
          <span v-for="tag in form.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <span v-if="form.source" class="form-hint">{{ form.source }}</span>
      </div>

      <div class="preview-section">
        <span class="preview-label">Question</span>
        <div v-if="form.text" class="preview-content">
          <template v-for="(part, i) in parseLatexParts(form.text)" :key="'q' + i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
            <span v-else>{{ part.content }}</span>
          </template>
        </div>
        <span v-else class="placeholder-text">Your question will appear here.</span>

        <div v-if="form.images?.length" class="preview-images">
          <figure v-for="(img, imgIdx) in form.images" :key="imgIdx" class="preview-image">
            <img :src="img.url" :alt="img.caption || 'Question image'" width="220" height="150" loading="lazy" decoding="async" />
            <figcaption v-if="img.caption">{{ img.caption }}</figcaption>
          </figure>
        </div>

        <div v-if="(form.type === 'single_choice' || form.type === 'multiple_choice') && form.options?.some(option => option.trim())" class="preview-options">
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

      <div v-if="form.answer || (Array.isArray(form.answer) && form.answer.length)" class="preview-section">
        <span class="preview-label">Answer</span>
        <div class="preview-content">
          <template v-if="isOptionQuestionType(form.type)">
            <strong>{{ Array.isArray(form.answer) ? form.answer.join(', ') : form.answer }}</strong>
          </template>
          <template v-else v-for="(part, i) in parseLatexParts(typeof form.answer === 'string' ? form.answer : '')" :key="'a' + i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
            <span v-else>{{ part.content }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="cheatsheet card">
      <h3>LaTeX Quick Reference</h3>
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
</template>

<script setup lang="ts">
import type { QuestionFormInput } from '~/types/question'
import { isOptionQuestionType } from '~/domain/questions'

defineProps<{
  form: QuestionFormInput
  essayBlankHeight: number
  cheatSheet: Array<{ label: string; code: string; formula: string }>
}>()
</script>

<style scoped>
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 850;
}
.preview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), transparent 36%),
    var(--color-surface);
  position: relative;
  overflow: hidden;
}
[data-theme="dark"] .preview-card {
  background: var(--color-surface);
}
.preview-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--color-primary), var(--color-warm));
  transform-origin: top;
  animation: previewBar 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}
.preview-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: revealUp 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.preview-section:nth-of-type(2) { animation-delay: .06s; }
.preview-section:nth-of-type(3) { animation-delay: .12s; }
.preview-label {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-muted);
}
.preview-content {
  font-size: .95rem;
  line-height: 1.8;
  overflow-wrap: anywhere;
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
  min-width: 0;
  overflow-wrap: anywhere;
  animation: revealUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.preview-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}
.preview-image {
  margin: 0;
  max-width: 220px;
}
.preview-image img {
  width: 100%;
  max-height: 150px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}
.preview-image img:hover {
  transform: translateY(-2px) scale(1.015);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-soft);
}
.preview-image figcaption {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .78rem;
}
.essay-preview-space {
  margin-top: 14px;
  background-image: repeating-linear-gradient(to bottom, transparent 0 30px, rgba(118, 87, 255, 0.2) 31px 32px);
  animation: lineReveal .7s ease both;
}
.cheatsheet {
  margin-top: 20px;
  font-size: .85rem;
  overflow-x: auto;
}
.cheatsheet h3 {
  margin-bottom: 10px;
  font-size: .95rem;
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
@keyframes previewBar {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@keyframes lineReveal {
  from { opacity: 0; background-position-y: -12px; }
  to { opacity: 1; background-position-y: 0; }
}
:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
@media (max-width: 560px) {
  .preview-header,
  .preview-option {
    flex-direction: column;
  }

  .preview-image {
    max-width: 100%;
    width: 100%;
  }
}
</style>
