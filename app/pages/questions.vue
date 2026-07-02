<template>
  <div class="workspace-client-page">
    <ClientOnly>
      <QuestionWorkspace />
      <template #fallback>
        <section class="workspace-shell-fallback" aria-busy="true" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'


useSeoMeta({
  title: 'Workspace',
  description: 'Search, filter, and manage your question bank. Build test papers by selecting questions with drag-and-drop ordering.',
  robots: 'noindex, nofollow'
})

const QuestionWorkspace = defineAsyncComponent(
  () => import('~/components/QuestionWorkspace.vue')
)
</script>
