<template>
  <span ref="el" class="latex-render" :class="{ 'latex-block': block }" />
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'

type KatexModule = typeof import('katex')

const props = defineProps<{
  formula: string
  block?: boolean
}>()

const el = shallowRef<HTMLElement | null>(null)
let katexPromise: Promise<KatexModule> | null = null
let lastRenderedSignature = ''

async function loadKatex () {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex/dist/katex.min.css'),
      import('katex')
    ]).then(([, katex]) => katex)
  }
  return await katexPromise
}

function currentSignature () {
  return `${props.block ? 'block' : 'inline'}:${props.formula.trim()}`
}

async function render () {
  const target = el.value
  if (!target) return

  const formula = props.formula.trim()
  const requestedSignature = currentSignature()

  if (!formula) {
    target.textContent = ''
    lastRenderedSignature = ''
    return
  }

  if (requestedSignature === lastRenderedSignature) return

  try {
    const katex = await loadKatex()
    const target = el.value
    if (!target || requestedSignature !== currentSignature()) return

    katex.default.render(formula, target, {
      throwOnError: false,
      displayMode: props.block
    })
    lastRenderedSignature = requestedSignature
  } catch {
    const target = el.value
    if (target && requestedSignature === currentSignature()) {
      target.textContent = formula
      lastRenderedSignature = requestedSignature
    }
  }
}

onMounted(() => {
  void render()
})

watch(() => [props.formula, props.block], () => {
  void render()
})
</script>

<style scoped>
.latex-render { display: inline; }
.latex-block  { display: block; overflow-x: auto; padding: 4px 0; }
</style>
