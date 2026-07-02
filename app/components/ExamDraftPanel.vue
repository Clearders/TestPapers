<template>
  <div class="exam-draft-card card">
    <div class="exam-draft-head">
      <div>
        <h2><AppIcon name="paper" /> Exam Drafts</h2>
        <p>{{ summaryText }}</p>
      </div>
      <span v-if="activeDraftName" class="tag">Editing {{ activeDraftName }}</span>
    </div>

    <div class="exam-draft-controls">
      <div class="form-group draft-name-field">
        <label class="form-label" for="exam-draft-name">Draft Name</label>
        <input
          id="exam-draft-name"
          v-model="draftNameModel"
          class="form-input"
          name="examDraftName"
          placeholder="e.g. Algebra final draft"
        >
      </div>
      <button type="button" class="btn btn-primary draft-action" :disabled="!hasCurrentDraftContent" @click="emit('save')">
        <AppIcon name="check" />
        Save Draft
      </button>
    </div>

    <div v-if="draftList.length" class="exam-draft-controls exam-draft-controls--library">
      <div class="form-group draft-select-field">
        <label class="form-label" for="exam-draft-select">Saved Drafts</label>
        <select id="exam-draft-select" v-model="selectedDraftIdModel" class="form-input" name="examDraftSelect">
          <option value="">Select a draft</option>
          <option v-for="draft in draftList" :key="draft.id" :value="draft.id">
            {{ draft.name }} | {{ draft.questionCount }} q | {{ draft.totalMarks }} marks
          </option>
        </select>
      </div>
      <button type="button" class="btn btn-outline draft-action" :disabled="!selectedDraftId" @click="emit('load')">
        <AppIcon name="download" />
        Load
      </button>
      <button type="button" class="btn btn-danger draft-action" :disabled="!selectedDraftId" @click="emit('delete-draft')">
        <AppIcon name="trash" />
        Delete
      </button>
    </div>

    <div v-if="selectedDraft" class="exam-draft-meta">
      <span>{{ selectedDraft.title || 'Untitled paper' }}</span>
      <span>{{ selectedDraft.subject || 'No subject' }}</span>
      <span>Updated {{ formatDraftTimestamp(selectedDraft.updatedAt) }}</span>
    </div>
    <div v-if="savedAt" class="status-banner status-banner--success exam-draft-status" aria-live="polite">
      Draft saved {{ formatDraftTimestamp(savedAt) }}.
    </div>
    <div v-if="error" class="status-banner status-banner--error exam-draft-status" aria-live="polite">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExamDraftSummary } from '~/domain/papers'

const props = defineProps<{
  draftName: string
  selectedDraftId: string
  summaryText: string
  activeDraftName: string
  drafts: ExamDraftSummary[]
  selectedDraft: ExamDraftSummary | null
  savedAt: string | null
  error: string
  hasCurrentDraftContent: boolean
}>()

const emit = defineEmits<{
  'update:draftName': [value: string]
  'update:selectedDraftId': [value: string]
  'save': []
  'load': []
  'delete-draft': []
}>()

const draftNameModel = computed({
  get: () => props.draftName,
  set: (value: string) => emit('update:draftName', value)
})

const selectedDraftIdModel = computed({
  get: () => props.selectedDraftId,
  set: (value: string) => emit('update:selectedDraftId', value)
})

const draftList = computed(() => Array.isArray(props.drafts) ? props.drafts : [])

function formatDraftTimestamp (value: string | null) {
  if (!value) return 'just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.exam-draft-card {
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgba(0, 184, 148, 0.08), rgba(255, 138, 76, 0.04)),
    var(--color-surface);
}

.exam-draft-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.exam-draft-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 850;
}

.exam-draft-head p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .84rem;
}

.exam-draft-controls {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-width: 0;
}

.exam-draft-controls + .exam-draft-controls {
  margin-top: 12px;
}

.exam-draft-controls .form-group {
  margin-bottom: 0;
}

.draft-name-field,
.draft-select-field {
  flex: 1;
  min-width: 220px;
}

.draft-action {
  min-height: 40px;
  white-space: nowrap;
}

.exam-draft-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
  color: var(--color-muted);
  font-size: .82rem;
}

.exam-draft-meta span + span::before {
  content: "/";
  margin-right: 14px;
  color: color-mix(in srgb, var(--color-muted) 54%, transparent);
}

.exam-draft-status {
  margin-top: 12px;
}

@media (max-width: 620px) {
  .exam-draft-controls,
  .exam-draft-controls .btn,
  .draft-name-field,
  .draft-select-field {
    width: 100%;
  }

  .exam-draft-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .exam-draft-meta span + span::before {
    content: "";
    margin-right: 0;
  }
}

@media print {
  .exam-draft-card {
    display: none !important;
  }
}
</style>
