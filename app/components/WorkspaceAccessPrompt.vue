<template>
  <div class="card workspace-access-card">
    <div class="workspace-access-icon">
      <AppIcon :name="isAuthenticated ? 'users' : 'account'" />
    </div>
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <div v-if="!isAuthenticated" class="workspace-access-actions">
      <NuxtLink to="/register" class="btn btn-primary">
        <AppIcon name="account" />
        Create Account
      </NuxtLink>
      <NuxtLink to="/login" class="btn btn-outline">
        <AppIcon name="login" />
        Login
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
  isAuthenticated: boolean
}>()
</script>

<style scoped>
.workspace-access-card {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 14px;
}

.workspace-access-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  color: var(--color-on-primary);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: var(--shadow-soft);
}

.workspace-access-card h2 {
  font-size: 1.08rem;
}

.workspace-access-card p {
  color: var(--color-muted);
  line-height: 1.6;
}

.workspace-access-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
