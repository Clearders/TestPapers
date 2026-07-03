import type { ApiErrorInfo } from '~/utils/apiError'
import type { DraftComment, DraftCommentStatus, DraftReviewStatus, SharedDraftSummary } from '~/types/draft'
import type { WorkspaceDraft } from '~/domain/papers'

type DraftIdentity = Pick<SharedDraftSummary, 'publicId'>

export interface SharedDraftDeletionResult<TSummary extends DraftIdentity, TActiveDraft extends DraftIdentity> {
  drafts: TSummary[]
  activeDraft: TActiveDraft | null
  selectedDraftId: string
  deletedListed: boolean
  deletedActive: boolean
  deletedSelected: boolean
}

export function canManageSharedDraft (draft: Pick<SharedDraftSummary, 'accessRole'> | null) {
  return draft?.accessRole === 'owner' || draft?.accessRole === 'admin'
}

export function canEditSharedDraft (draft: Pick<SharedDraftSummary, 'accessRole'> | null) {
  return canManageSharedDraft(draft) || draft?.accessRole === 'editor'
}

export function canCommentOnSharedDraft (draft: Pick<SharedDraftSummary, 'accessRole'> | null) {
  return Boolean(draft)
}

export function groupDraftComments (comments: DraftComment[]) {
  return {
    open: comments.filter(comment => comment.status === 'open'),
    resolved: comments.filter(comment => comment.status === 'resolved')
  }
}

export function draftCommentCount (comments: DraftComment[], status?: DraftCommentStatus) {
  return status ? comments.filter(comment => comment.status === status).length : comments.length
}

export function openCommentCountsByQuestion (comments: DraftComment[]) {
  const counts: Record<string, number> = {}
  for (const comment of comments) {
    if (comment.status !== 'open' || !comment.questionPublicId) continue
    counts[comment.questionPublicId] = (counts[comment.questionPublicId] || 0) + 1
  }
  return counts
}

export function hasSharedDraftChanges (currentDraft: WorkspaceDraft, savedDraft: WorkspaceDraft | null | undefined) {
  if (!savedDraft) return false
  return JSON.stringify(currentDraft) !== JSON.stringify(savedDraft)
}

export function isDraftRevisionConflict (error: ApiErrorInfo | unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'DRAFT_REVISION_CONFLICT'
}

export function applySharedDraftDeleted<TSummary extends DraftIdentity, TActiveDraft extends DraftIdentity> (
  state: { drafts: TSummary[], activeDraft: TActiveDraft | null, selectedDraftId: string },
  draftId: string
): SharedDraftDeletionResult<TSummary, TActiveDraft> {
  const deletedListed = state.drafts.some(draft => draft.publicId === draftId)
  const deletedActive = state.activeDraft?.publicId === draftId
  const deletedSelected = state.selectedDraftId === draftId

  return {
    drafts: state.drafts.filter(draft => draft.publicId !== draftId),
    activeDraft: deletedActive ? null : state.activeDraft,
    selectedDraftId: deletedSelected ? '' : state.selectedDraftId,
    deletedListed,
    deletedActive,
    deletedSelected
  }
}

export function nextReviewStatuses (draft: Pick<SharedDraftSummary, 'accessRole' | 'reviewStatus'> | null): DraftReviewStatus[] {
  if (!draft) return []
  if (draft.accessRole === 'owner' || draft.accessRole === 'admin') {
    return ['draft', 'in_review', 'changes_requested', 'approved']
  }
  if (draft.accessRole === 'editor' && draft.reviewStatus !== 'approved') {
    return ['in_review']
  }
  return []
}
