<template>
  <div v-if="pagination.totalPages > 1" class="pagination-controls">
    <button
      type="button"
      class="btn btn-outline btn-sm"
      :disabled="loading || pagination.page <= 1"
      aria-label="Go to previous page"
      @click="emit('change', pagination.page - 1)"
    >
      Previous
    </button>
    <span class="pagination-status" aria-live="polite" role="status">
      Page {{ pagination.page }} of {{ pagination.totalPages }}
      <span class="pagination-summary">({{ firstItem }}&ndash;{{ lastItem }} of {{ pagination.total }})</span>
    </span>
    <button
      type="button"
      class="btn btn-outline btn-sm"
      :disabled="loading || pagination.page >= pagination.totalPages"
      aria-label="Go to next page"
      @click="emit('change', pagination.page + 1)"
    >
      Next
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiPagination } from '~/types/api'

const props = withDefaults(defineProps<{
  pagination: ApiPagination
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{
  change: [page: number]
}>()

const firstItem = computed(() => {
  if (props.pagination.total === 0 || props.pagination.pageSize === 0) return 0
  return (props.pagination.page - 1) * props.pagination.pageSize + 1
})

const lastItem = computed(() =>
  Math.min(props.pagination.page * props.pagination.pageSize, props.pagination.total)
)
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
  color: var(--color-muted, #6b7280);
  font-size: .86rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pagination-summary {
  display: block;
  font-size: .78rem;
  color: var(--color-muted, #9ca3af);
}
</style>
