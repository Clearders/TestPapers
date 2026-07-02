import type { ApiErrorInfo } from '~/utils/apiError'
import type { DraftComment, DraftCommentStatus, DraftReviewStatus, SharedDraftSummary } from '~/types/draft'

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

export function isDraftRevisionConflict (error: ApiErrorInfo | unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'DRAFT_REVISION_CONFLICT'
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
