<template>
  <QuestionWorkspace />
</template>

<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  permissions: ['questions:read']
})

useHead({
  title: 'Workspace | TestPapers'
})
</script>
