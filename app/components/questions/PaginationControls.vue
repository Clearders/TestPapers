<template>
  <div v-if="pagination.totalPages > 1" class="pagination-controls">
    <button class="btn btn-outline btn-sm" :disabled="loading || pagination.page <= 1" @click="$emit('change', pagination.page - 1)">
      Previous
    </button>
    <span class="pagination-status">
      Page {{ pagination.page }} of {{ pagination.totalPages }}
    </span>
    <button class="btn btn-outline btn-sm" :disabled="loading || pagination.page >= pagination.totalPages" @click="$emit('change', pagination.page + 1)">
      Next
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ApiPagination } from '~/types/api'

defineProps<{
  pagination: ApiPagination
  loading?: boolean
}>()

defineEmits<{
  change: [page: number]
}>()
</script>

<style scoped>
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.pagination-status {
  color: var(--color-muted);
  font-size: .86rem;
}
</style>
