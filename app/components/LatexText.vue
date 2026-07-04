<template>
  <template v-for="(part, index) in parts" :key="index">
    <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="blockLatex && part.block" />
    <span v-else>{{ part.content }}</span>
  </template>
</template>

<script setup lang="ts">
import { parseLatexParts } from '~/composables/useLatexParts'

const props = withDefaults(defineProps<{
  text?: string | number | null
  blockLatex?: boolean
}>(), {
  text: '',
  blockLatex: true
})

const parts = computed(() => parseLatexParts(String(props.text ?? '')))
</script>
