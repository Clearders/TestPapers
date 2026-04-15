<template>
  <section>
    <h1 class="page-title">Welcome to TestPapers 📝</h1>
    <p class="page-sub">Create, manage, and export professional test papers with real-time LaTeX support.</p>

    <!-- Feature cards -->
    <div class="feature-grid">
      <NuxtLink to="/questions" class="feature-card card">
        <div class="feature-icon">🔍</div>
        <h2>Browse Questions</h2>
        <p>Search and filter your question bank. Preview LaTeX formulae inline.</p>
        <span class="btn btn-outline btn-sm" style="margin-top:auto">Go →</span>
      </NuxtLink>

      <NuxtLink to="/papers" class="feature-card card">
        <div class="feature-icon">📄</div>
        <h2>Assemble Paper</h2>
        <p>Pick questions from the bank and arrange them into a complete test paper.</p>
        <span class="btn btn-outline btn-sm" style="margin-top:auto">Go →</span>
      </NuxtLink>

      <NuxtLink to="/add-problem" class="feature-card card">
        <div class="feature-icon">➕</div>
        <h2>Add Problem</h2>
        <p>Compose a new problem with a live LaTeX preview as you type.</p>
        <span class="btn btn-primary btn-sm" style="margin-top:auto">Go →</span>
      </NuxtLink>
    </div>

    <!-- LaTeX demo -->
    <div class="demo-box card" style="margin-top:32px">
      <h2 style="margin-bottom:16px">Real-time LaTeX Preview</h2>
      <p class="form-hint" style="margin-bottom:12px">Type a LaTeX expression below and see it rendered instantly.</p>
      <div class="demo-editor">
        <textarea
          v-model="demoFormula"
          class="form-input demo-textarea"
          placeholder="e.g. \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
          spellcheck="false"
        />
        <div class="demo-preview card">
          <span class="form-hint" style="display:block;margin-bottom:8px">Preview:</span>
          <LatexRenderer v-if="demoFormula" :formula="demoFormula" :block="true" />
          <span v-else class="form-hint" style="font-style:italic">Start typing above…</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const demoFormula = ref('\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}')
</script>

<style scoped>
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}
.feature-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 28px 22px; border-radius: var(--radius);
  transition: box-shadow .2s, transform .2s;
  color: var(--color-text);
}
.feature-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,.12); transform: translateY(-2px); }
.feature-icon { font-size: 2.2rem; }
.feature-card h2 { font-size: 1.1rem; font-weight: 700; }
.feature-card p  { font-size: .9rem; color: var(--color-muted); flex: 1; }
.demo-editor { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.demo-textarea { width: 100%; min-height: 120px; resize: vertical; font-family: monospace; }
.demo-preview { min-height: 120px; display: flex; flex-direction: column; }
@media (max-width: 640px) {
  .demo-editor { grid-template-columns: 1fr; }
}
</style>
