<template>
  <div class="preview-panel">
    <div class="panel-head">
      <h2>Live Preview</h2>
    </div>

    <div class="preview-card card">
      <div class="preview-header">
        <div class="preview-meta">
          <span v-if="form.difficulty" class="badge" :class="`badge-${form.difficulty}`">{{ form.difficulty }}</span>
          <span v-if="form.subject" class="tag">{{ form.subject }}</span>
          <span class="tag">weight {{ form.scoreWeight }}</span>
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

        <div v-if="form.images.length" class="preview-images">
          <figure v-for="(img, imgIdx) in form.images" :key="imgIdx" class="preview-image">
            <img :src="img.url" :alt="img.caption || 'Question image'" />
            <figcaption v-if="img.caption">{{ img.caption }}</figcaption>
          </figure>
        </div>

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
          <template v-if="form.type === 'choice' || form.type === 'true_false'">
            <strong>{{ form.answer }}</strong>
          </template>
          <template v-else v-for="(part, i) in parseLatexParts(form.answer)" :key="'a' + i">
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
import type { EssayBlankSpace, QuestionDifficulty, QuestionImage, QuestionType } from '~/types/question'

interface ProblemFormPreview {
  type: QuestionType
  subject: string
  difficulty: QuestionDifficulty | ''
  tags: string[]
  questionText: string
  options: string[]
  answer: string
  source: string
  essayBlankSpace: EssayBlankSpace
  images: QuestionImage[]
  scoreWeight: number
}

defineProps<{
  form: ProblemFormPreview
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
}
.preview-image figcaption {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .78rem;
}
.essay-preview-space {
  margin-top: 14px;
}
.cheatsheet {
  margin-top: 20px;
  font-size: .85rem;
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
</style>
