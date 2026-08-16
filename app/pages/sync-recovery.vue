<template>
  <SyncConflictRecovery v-if="conflictId" :conflict-id="conflictId" />
  <section v-else class="card recovery-empty" aria-labelledby="recovery-empty-title">
    <span class="state-icon"><AppIcon name="settings" /></span>
    <h1 id="recovery-empty-title">Open a Sync recovery notification</h1>
    <p>Conflict links include a private conflict ID. Open the notification from Desktop or your account activity to compare the preserved Local, Cloud, and baseline snapshots.</p>
    <p><strong>Realtime collaborative revisions are managed in the draft editor and never appear here.</strong></p>
    <NuxtLink class="btn btn-outline" to="/questions">Return to workspace</NuxtLink>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const conflictId = computed(() => typeof route.query.conflict === 'string' ? route.query.conflict : '')

definePageMeta({ requiresAuth: true })
useSeoMeta({ title: 'Sync recovery', description: 'Compare personal-device Sync conflicts and restore accepted versions.', robots: 'noindex, nofollow' })
</script>

<style scoped>
.recovery-empty{max-width:640px;margin:8vh auto;text-align:center}.recovery-empty .state-icon{margin:0 auto 16px}.recovery-empty h1{font-size:clamp(1.6rem,4vw,2.4rem)}.recovery-empty p{color:var(--color-muted);line-height:1.6}.recovery-empty .btn{margin-top:10px}
</style>
