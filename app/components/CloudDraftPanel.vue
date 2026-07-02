<template>
  <div class="cloud-draft-card card">
    <div class="cloud-draft-head">
      <div>
        <h2><AppIcon name="users" /> Cloud Drafts</h2>
        <p>{{ summaryText }}</p>
      </div>
      <span v-if="activeDraft" class="tag" :class="`review-${activeDraft.reviewStatus}`">
        {{ reviewLabel(activeDraft.reviewStatus) }}
      </span>
    </div>

    <div class="cloud-draft-controls">
      <div class="form-group cloud-name-field">
        <label class="form-label" for="cloud-draft-name">Cloud Draft Name</label>
        <input
          id="cloud-draft-name"
          v-model="draftNameModel"
          class="form-input"
          name="cloudDraftName"
          placeholder="e.g. Shared algebra final"
          :disabled="!!activeDraft && !canManageActive"
        >
      </div>
      <button type="button" class="btn btn-primary draft-action" :disabled="isSaving || !hasCurrentDraftContent || (!!activeDraft && !canEditActive)" @click="emit('save')">
        <AppIcon name="upload" />
        {{ activeDraft ? 'Save Cloud Draft' : 'Create Cloud Draft' }}
      </button>
      <button type="button" class="btn btn-outline draft-action" :disabled="!activeDraft || isDownloading" @click="emit('download')">
        <AppIcon name="download" />
        {{ isDownloading ? 'Preparing...' : 'Download' }}
      </button>
    </div>

    <div class="cloud-draft-controls cloud-draft-controls--library">
      <div class="form-group cloud-select-field">
        <label class="form-label" for="cloud-draft-select">Shared Drafts</label>
        <select id="cloud-draft-select" v-model="selectedDraftIdModel" class="form-input" name="cloudDraftSelect">
          <option value="">{{ isLoading ? 'Loading drafts...' : 'Select a cloud draft' }}</option>
          <option v-for="draft in drafts" :key="draft.publicId" :value="draft.publicId">
            {{ draft.name }} | {{ reviewLabel(draft.reviewStatus) }} | {{ draft.openCommentCount }} open
          </option>
        </select>
      </div>
      <button type="button" class="btn btn-outline draft-action" :disabled="!selectedDraftId || isLoading" @click="emit('load')">
        <AppIcon name="download" />
        Load
      </button>
      <button type="button" class="btn btn-danger draft-action" :disabled="!selectedDraftId || !canManageActive" @click="emit('delete-draft')">
        <AppIcon name="trash" />
        Delete
      </button>
      <button type="button" class="btn btn-outline draft-action" :disabled="isLoading" @click="emit('reload')">
        <AppIcon name="search" />
        Refresh
      </button>
    </div>

    <div v-if="activeDraft" class="active-cloud-meta">
      <span>{{ accessLabel(activeDraft.accessRole) }}</span>
      <span>{{ activeDraft.collaboratorCount }} collaborator{{ activeDraft.collaboratorCount === 1 ? '' : 's' }}</span>
      <span>{{ activeDraft.openCommentCount }} open comment{{ activeDraft.openCommentCount === 1 ? '' : 's' }}</span>
      <span>Revision {{ activeDraft.revision }}</span>
      <span>Updated {{ formatTimestamp(activeDraft.updatedAt) }}</span>
    </div>

    <div v-if="activeDraft" class="review-actions">
      <span class="review-label">Review</span>
      <button
        v-for="status in reviewStatuses"
        :key="status.value"
        type="button"
        class="btn btn-sm"
        :class="activeDraft.reviewStatus === status.value ? 'btn-primary' : 'btn-outline'"
        :disabled="!canEditActive || isSaving"
        @click="emit('set-review-status', status.value)"
      >
        {{ status.label }}
      </button>
    </div>

    <div v-if="activeDraft && canManageActive" class="sharing-box">
      <div class="sharing-head">
        <span>Sharing</span>
        <span>{{ activeDraft.collaborators.length }} listed</span>
      </div>
      <div class="cloud-draft-controls sharing-add">
        <input
          v-model="collaboratorUsernameModel"
          class="form-input"
          name="cloudDraftCollaborator"
          placeholder="Username"
        >
        <select v-model="collaboratorRoleModel" class="form-input collaborator-role" name="cloudDraftCollaboratorRole">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="button" class="btn btn-outline draft-action" :disabled="!collaboratorUsername.trim()" @click="emit('add-collaborator')">
          <AppIcon name="add" />
          Add
        </button>
      </div>
      <div v-if="activeDraft.collaborators.length" class="collaborator-list">
        <div v-for="collaborator in activeDraft.collaborators" :key="collaborator.user.publicId" class="collaborator-row">
          <div>
            <strong>{{ collaborator.user.displayName }}</strong>
            <span>@{{ collaborator.user.username }}</span>
          </div>
          <select class="form-input collaborator-role" :value="collaborator.role" @change="onCollaboratorRoleChange(collaborator.user.publicId, $event)">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button type="button" class="icon-btn" aria-label="Remove collaborator" @click="emit('remove-collaborator', collaborator.user.publicId)">
            <AppIcon name="x" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="savedAt" class="status-banner status-banner--success cloud-draft-status" aria-live="polite">
      Cloud draft saved {{ formatTimestamp(savedAt) }}.
    </div>
    <div v-if="conflict" class="status-banner status-banner--error cloud-draft-status" aria-live="polite">
      This cloud draft changed elsewhere. Refresh or load the latest revision before saving again.
    </div>
    <div v-if="error" class="status-banner status-banner--error cloud-draft-status" aria-live="polite">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DraftCollaboratorRole, DraftReviewStatus, SharedDraft, SharedDraftSummary } from '~/types/draft'

const props = defineProps<{
  drafts: SharedDraftSummary[]
  activeDraft: SharedDraft | null
  selectedDraftId: string
  draftName: string
  collaboratorUsername: string
  collaboratorRole: DraftCollaboratorRole
  isLoading: boolean
  isSaving: boolean
  isDownloading: boolean
  error: string
  conflict: boolean
  savedAt: string | null
  hasCurrentDraftContent: boolean
  canManageActive: boolean
  canEditActive: boolean
}>()

const emit = defineEmits<{
  'update:selectedDraftId': [value: string]
  'update:draftName': [value: string]
  'update:collaboratorUsername': [value: string]
  'update:collaboratorRole': [value: DraftCollaboratorRole]
  save: []
  load: []
  'delete-draft': []
  reload: []
  download: []
  'set-review-status': [value: DraftReviewStatus]
  'add-collaborator': []
  'update-collaborator': [userPublicId: string, role: DraftCollaboratorRole]
  'remove-collaborator': [userPublicId: string]
}>()

const reviewStatuses: { value: DraftReviewStatus, label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'approved', label: 'Approved' }
]

const selectedDraftIdModel = computed({
  get: () => props.selectedDraftId,
  set: (value: string) => emit('update:selectedDraftId', value)
})

const draftNameModel = computed({
  get: () => props.draftName,
  set: (value: string) => emit('update:draftName', value)
})

const collaboratorUsernameModel = computed({
  get: () => props.collaboratorUsername,
  set: (value: string) => emit('update:collaboratorUsername', value)
})

const collaboratorRoleModel = computed({
  get: () => props.collaboratorRole,
  set: (value: DraftCollaboratorRole) => emit('update:collaboratorRole', value)
})

const summaryText = computed(() => {
  if (!props.drafts.length) return 'No backend-saved shared drafts yet.'
  return `${props.drafts.length} cloud draft${props.drafts.length === 1 ? '' : 's'} available.`
})

function reviewLabel (value: DraftReviewStatus) {
  return reviewStatuses.find(status => status.value === value)?.label || 'Draft'
}

function accessLabel (value: string) {
  if (value === 'owner') return 'Owner'
  if (value === 'admin') return 'Admin access'
  if (value === 'editor') return 'Editor access'
  return 'Viewer access'
}

function formatTimestamp (value: string | null) {
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

function onCollaboratorRoleChange (userPublicId: string, event: Event) {
  const role = (event.target as HTMLSelectElement).value as DraftCollaboratorRole
  emit('update-collaborator', userPublicId, role)
}
</script>

<style scoped>
.cloud-draft-card {
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(118, 87, 255, 0.04)),
    var(--color-surface);
}

.cloud-draft-head,
.sharing-head,
.collaborator-row,
.review-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cloud-draft-head {
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.cloud-draft-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 850;
}

.cloud-draft-head p,
.active-cloud-meta,
.sharing-head,
.collaborator-row span {
  color: var(--color-muted);
  font-size: .84rem;
}

.cloud-draft-controls {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-width: 0;
}

.cloud-draft-controls + .cloud-draft-controls,
.review-actions,
.sharing-box {
  margin-top: 12px;
}

.cloud-draft-controls .form-group {
  margin-bottom: 0;
}

.cloud-name-field,
.cloud-select-field {
  flex: 1;
  min-width: 220px;
}

.draft-action {
  min-height: 40px;
  white-space: nowrap;
}

.active-cloud-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
}

.active-cloud-meta span + span::before {
  content: "/";
  margin-right: 14px;
  color: color-mix(in srgb, var(--color-muted) 54%, transparent);
}

.review-actions {
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.review-label,
.sharing-head span:first-child {
  font-size: .82rem;
  font-weight: 800;
  color: var(--color-text);
}

.sharing-box {
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.sharing-add {
  align-items: center;
}

.sharing-add input {
  flex: 1;
  min-width: 180px;
}

.collaborator-role {
  width: 132px;
  min-width: 132px;
}

.collaborator-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.collaborator-row {
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

.collaborator-row > div {
  flex: 1;
  min-width: 0;
}

.collaborator-row strong,
.collaborator-row span {
  display: block;
  overflow-wrap: anywhere;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
}

.icon-btn:hover {
  color: var(--color-danger-text);
  border-color: var(--color-danger);
}

.cloud-draft-status {
  margin-top: 12px;
}

.review-approved {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-success-text);
}

.review-changes_requested {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-danger-text);
}

.review-in_review {
  border-color: rgba(234, 179, 8, 0.26);
  background: rgba(234, 179, 8, 0.1);
  color: var(--color-warning);
}

@media (max-width: 700px) {
  .cloud-draft-controls,
  .cloud-draft-controls .btn,
  .cloud-name-field,
  .cloud-select-field,
  .sharing-add input,
  .collaborator-role {
    width: 100%;
  }

  .cloud-draft-controls,
  .collaborator-row {
    align-items: stretch;
    flex-direction: column;
  }

  .active-cloud-meta span + span::before {
    content: "";
    margin-right: 0;
  }
}

@media print {
  .cloud-draft-card {
    display: none !important;
  }
}
</style>
