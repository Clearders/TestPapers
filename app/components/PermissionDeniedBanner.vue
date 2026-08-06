<template>
  <div class="permission-banner status-banner status-banner--warning" role="alert" aria-live="polite">
    <AppIcon name="account" />
    <div class="permission-banner-text">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
</script>

<style scoped>
.permission-banner {
  align-items: flex-start;
  margin-bottom: 16px;
}

.permission-banner .app-icon {
  margin-top: 2px;
}

.permission-banner-text {
  min-width: 0;
}

.permission-banner-text strong {
  display: block;
  font-size: .86rem;
}

.permission-banner-text p {
  margin-top: 3px;
  font-size: .82rem;
  line-height: 1.45;
}
</style>
