<template>
  <div class="revision-panel">
    <button class="revision-toggle" type="button" @click="toggle">
      <span>{{ isOpen ? 'Hide History' : 'History' }}</span>
      <span v-if="revisions.length && !isOpen" class="revision-count">{{ revisions.length }}</span>
    </button>

    <div v-if="isOpen" class="revision-list">
      <div v-if="loading" class="revision-loading">Loading history…</div>
      <div v-else-if="error" class="revision-error">{{ error }}</div>
      <div v-else-if="!revisions.length" class="revision-empty">No revision history.</div>
      <div
        v-for="rev in revisions"
        :key="rev.id"
        class="revision-item"
      >
        <button class="revision-item-head" type="button" @click="toggleRevision(rev.id)">
          <div class="revision-item-meta">
            <span class="revision-summary">{{ rev.changeSummary }}</span>
            <span class="revision-date">{{ formatDate(rev.createdAt) }}</span>
          </div>
          <div class="revision-item-actions">
            <button
              v-if="canDelete"
              class="revision-delete-btn"
              type="button"
              aria-label="Delete revision"
              @click.stop="handleDeleteRevision(rev.id)"
            >&times;</button>
            <span class="revision-chevron" :class="{ 'is-open': expandedIds.has(rev.id) }">&#9660;</span>
          </div>
        </button>
        <div v-if="expandedIds.has(rev.id)" class="revision-detail">
          <table class="revision-diff-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(value, key) in rev.patch" :key="key">
                <td class="revision-field-name">{{ formatFieldName(key) }}</td>
                <td class="revision-field-value">{{ formatFieldValue(value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionRevision } from '~/types/question'

const props = defineProps<{
  questionId: number
  canDelete: boolean
}>()

const { fetchRevisions, deleteRevision } = useQuestionBank()
const isOpen = ref(false)
const loading = ref(false)
const error = ref('')
const revisions = ref<QuestionRevision[]>([])
const expandedIds = ref(new Set<number>())

const FIELD_LABELS: Record<string, string> = {
  type: 'Type',
  subjects: 'Subjects',
  difficulty: 'Difficulty',
  tags: 'Tags',
  text: 'Text',
  options: 'Options',
  answer: 'Answer',
  source: 'Source',
  essayBlankSpace: 'Essay Blank Space',
  images: 'Images',
  scoreWeight: 'Score Weight'
}

async function toggle () {
  isOpen.value = !isOpen.value
  if (isOpen.value && !revisions.value.length && !loading.value) {
    await loadRevisions()
  }
}

async function loadRevisions () {
  loading.value = true
  error.value = ''
  try {
    revisions.value = await fetchRevisions(props.questionId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load revision history.'
  } finally {
    loading.value = false
  }
}

function toggleRevision (id: number) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function formatDate (dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

async function handleDeleteRevision (revisionId: number) {
  try {
    await deleteRevision(props.questionId, revisionId)
    revisions.value = revisions.value.filter(r => r.id !== revisionId)
  } catch {
    // silently ignore
  }
}

function formatFieldName (key: string) {
  return FIELD_LABELS[key] || key
}

function formatFieldValue (value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.revision-panel {
  margin-top: 10px;
}
.revision-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: .8rem;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.revision-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg);
}
.revision-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: .7rem;
  font-weight: 600;
  padding: 0 4px;
}
.revision-list {
  margin-top: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.revision-loading,
.revision-error,
.revision-empty {
  padding: 12px;
  font-size: .82rem;
  color: var(--color-muted);
}
.revision-error {
  color: var(--color-danger);
}
.revision-item {
  border-bottom: 1px solid var(--color-border);
}
.revision-item:last-child {
  border-bottom: none;
}
.revision-item-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}
.revision-item-head:hover {
  background: var(--color-bg);
}
.revision-item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.revision-summary {
  font-size: .82rem;
  font-weight: 500;
}
.revision-date {
  font-size: .72rem;
  color: var(--color-muted);
}
.revision-chevron {
  font-size: .65rem;
  color: var(--color-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.revision-chevron.is-open {
  transform: rotate(180deg);
}
.revision-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.revision-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: .9rem;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}
.revision-delete-btn:hover {
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.08);
}
.revision-detail {
  padding: 0 12px 10px;
}
.revision-diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .78rem;
}
.revision-diff-table th,
.revision-diff-table td {
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}
.revision-diff-table th {
  background: var(--color-bg);
  font-weight: 600;
  color: var(--color-muted);
  font-size: .72rem;
  text-transform: uppercase;
}
.revision-field-name {
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-muted);
}
.revision-field-value {
  word-break: break-word;
}
</style>
