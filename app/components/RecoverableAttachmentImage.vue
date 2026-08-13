<template>
  <span class="attachment-frame" :class="{ 'attachment-frame--failed': failed }">
    <img
      v-if="!failed"
      :key="attempt"
      v-bind="$attrs"
      :src="src"
      :alt="alt"
      :title="title"
      :width="width"
      :height="height"
      loading="lazy"
      decoding="async"
      @load="failed = false"
      @error="failed = true"
    >
    <span v-else class="attachment-placeholder" role="status" aria-live="polite">
      <strong>Attachment unavailable</strong>
      <small>The question content is still available. The verified file may be missing, offline, or waiting to sync.</small>
      <button type="button" class="attachment-retry" @click="retry">Retry</button>
    </span>
  </span>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src: string
  alt: string
  title?: string
  width?: number
  height?: number
}>(), {
  title: '',
  width: 160,
  height: 120
})

const failed = ref(false)
const attempt = ref(0)

watch(() => props.src, () => {
  failed.value = false
  attempt.value += 1
})

function retry () {
  attempt.value += 1
  failed.value = false
}
</script>

<style scoped>
.attachment-frame { display: inline-grid; min-width: 0; }
.attachment-frame > img { max-width: 100%; }
.attachment-placeholder { display: grid; gap: 6px; align-content: center; width: min(100%, 260px); min-height: 120px; padding: 14px; border: 1px dashed var(--color-warning); border-radius: var(--radius); background: color-mix(in srgb, var(--color-warning) 7%, var(--color-surface-solid)); color: var(--color-text); }
.attachment-placeholder small { color: var(--color-muted); line-height: 1.4; }
.attachment-retry { justify-self: start; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 5px 10px; background: var(--color-surface-solid); color: var(--color-text); cursor: pointer; }
.attachment-retry:hover { border-color: var(--color-primary); color: var(--color-primary); }
</style>
