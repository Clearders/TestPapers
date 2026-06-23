<template>
  <span ref="el" class="latex-render" :class="{ 'latex-block': block }" />
</template>

<script setup lang="ts">
type KatexModule = typeof import('katex')

const props = defineProps<{
  formula: string
  block?: boolean
}>()

const el = ref<HTMLElement | null>(null)
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
  if (!el.value) return

  const formula = props.formula.trim()
  const requestedSignature = currentSignature()

  if (!formula) {
    el.value.textContent = ''
    lastRenderedSignature = ''
    return
  }

  if (requestedSignature === lastRenderedSignature) return

  try {
    const katex = await loadKatex()
    if (!el.value || requestedSignature !== currentSignature()) return

    katex.default.render(formula, el.value, {
      throwOnError: false,
      displayMode: !!props.block
    })
    lastRenderedSignature = requestedSignature
  } catch {
    if (el.value && requestedSignature === currentSignature()) {
      el.value.textContent = formula
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
