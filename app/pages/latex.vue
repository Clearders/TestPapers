<template>
  <section>
    <h1 class="page-title">{{ $t('latex.title') }}</h1>
    <p class="page-sub">{{ $t('latex.subtitle') }}</p>

    <div class="demo-box card" style="margin-top:20px">
      <div class="demo-editor">
        <textarea
          v-model="demoFormula"
          class="form-input demo-textarea"
          placeholder="e.g. \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
          spellcheck="false"
        />
        <div class="demo-preview card">
          <span class="form-hint" style="display:block;margin-bottom:8px">{{ $t('latex.preview') }}:</span>
          <LatexRenderer v-if="demoFormula" :formula="demoFormula" :block="true" />
          <span v-else class="form-hint" style="font-style:italic">{{ $t('latex.startTyping') }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const demoFormula = ref('\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}')
</script>

<style scoped>
.demo-editor { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.demo-textarea {
  width: 100%; min-height: 200px; resize: vertical; font-family: monospace;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.demo-textarea:focus {
  box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.15);
  transform: scale(1.01);
}
.demo-preview {
  min-height: 200px; display: flex; flex-direction: column;
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}
.demo-preview:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
@media (max-width: 640px) {
  .demo-editor { grid-template-columns: 1fr; }
}
</style>
