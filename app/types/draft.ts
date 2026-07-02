import type { WorkspaceDraft } from '~/domain/papers'

export type DraftCollaboratorRole = 'viewer' | 'editor'
export type DraftAccessRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type DraftCommentStatus = 'open' | 'resolved'
export type DraftReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved'

export interface DraftUserRef {
  publicId: string
  username: string
  displayName: string
}

export interface DraftCollaborator {
  user: DraftUserRef
  role: DraftCollaboratorRole
  createdAt: string
  updatedAt: string
}

export interface DraftComment {
  id: number
  publicId: string
  questionPublicId?: string | null
  message: string
  status: DraftCommentStatus
  author?: DraftUserRef | null
  createdAt: string
  updatedAt: string
}

export interface SharedDraftSummary {
  id: number
  publicId: string
  name: string
  owner?: DraftUserRef | null
  accessRole: DraftAccessRole
  reviewStatus: DraftReviewStatus
  revision: number
  collaboratorCount: number
  commentCount: number
  openCommentCount: number
  updatedBy?: DraftUserRef | null
  createdAt: string
  updatedAt: string
}

export interface SharedDraft extends SharedDraftSummary {
  state: WorkspaceDraft
  collaborators: DraftCollaborator[]
  comments: DraftComment[]
}

export interface DraftRevisionConflict {
  code: 'DRAFT_REVISION_CONFLICT'
  currentRevision: number
  message: string
}

export interface SharedDraftCreatePayload {
  name: string
  state: WorkspaceDraft
}

export interface SharedDraftUpdatePayload {
  baseRevision: number
  name?: string
  state?: WorkspaceDraft
  reviewStatus?: DraftReviewStatus
}
