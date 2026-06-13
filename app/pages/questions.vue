<template>
  <QuestionWorkspace />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

definePageMeta({
  requiresAuth: true,
  permissions: ['questions:read']
})

useSeoMeta({
  title: 'Workspace',
  description: 'Search, filter, and manage your question bank. Build test papers by selecting questions with drag-and-drop ordering.',
  robots: 'noindex, nofollow'
})

const QuestionWorkspace = defineAsyncComponent(
  () => import('~/components/QuestionWorkspace.vue')
)
</script>
