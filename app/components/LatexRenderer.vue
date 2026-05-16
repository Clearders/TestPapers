<template>
  <span ref="el" class="latex-render" :class="{ 'latex-block': block }" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  formula: string
  block?: boolean
}>()

const el = ref<HTMLElement | null>(null)

async function render () {
  if (!el.value) return
  if (!props.formula.trim()) {
    el.value.textContent = ''
    return
  }
  try {
    const katex = await import('katex')
    katex.default.render(props.formula, el.value, {
      throwOnError: false,
      displayMode: !!props.block
    })
  } catch {
    if (el.value) el.value.textContent = props.formula
  }
}

onMounted(render)
watch(() => [props.formula, props.block], render)
</script>

<style scoped>
.latex-render { display: inline; }
.latex-block  { display: block; overflow-x: auto; padding: 4px 0; }
</style>
