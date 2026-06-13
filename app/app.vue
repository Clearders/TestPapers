<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useTheme()
useHead({
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover'
    }
  ]
})

const baseUrl = useRequestURL().origin
useSeoMeta({
  ogUrl: baseUrl,
  twitterSite: '@testpapers'
})

onErrorCaptured((err, instance, info) => {
  if (import.meta.client) {
    console.error('[TestPapers] Captured error:', err, info)
  }
  return false
})
</script>
