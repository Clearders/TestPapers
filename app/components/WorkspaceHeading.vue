<template>
  <div class="workspace-heading">
    <div>
      <h1 class="page-title"><AppIcon name="book" /> Workspace</h1>
      <p class="page-sub">Build an exam in the editor, then switch to the bank to search, filter, inspect, import, and add questions.</p>
    </div>
    <div class="workspace-stats">
      <span class="tag">{{ selectedCount }} selected</span>
      <span class="tag">{{ totalMarks }} marks</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selectedCount: number
  totalMarks: number
}>()
</script>

<style scoped>
.workspace-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title svg {
  color: var(--color-primary);
}

.workspace-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
}
</style>
