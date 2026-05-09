<template>
  <QuestionWorkspace />
</template>

<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  permissions: ['questions:read']
})

const { t } = useI18n()

useHead({
  title: computed(() => `${t('common.workspace')} | TestPapers`)
})
</script>
