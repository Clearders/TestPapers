import type { QuestionType } from '~/types/question'

export type BankVisibility = 'private' | 'team' | 'public'
export type BankRole = 'viewer' | 'editor'
export type BankAccessRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type BankListScope = 'visible' | 'owned' | 'subscribed' | 'public'

export interface BankUserRef {
  publicId: string
  username: string
  displayName: string
}

export interface BankMember {
  user: BankUserRef
  role: BankRole
  createdAt: string
  updatedAt: string
}

export interface QuestionBankSummary {
  id: number
  publicId: string
  name: string
  description: string
  visibility: BankVisibility
  owner?: BankUserRef | null
  accessRole: BankAccessRole
  version?: number | null
  itemCount: number
  memberCount: number
  subscriberCount: number
  isSubscribed: boolean
  subscribedVersion?: number | null
  hasUpdate: boolean
  createdAt: string
  updatedAt: string
}

export interface QuestionBank extends QuestionBankSummary {
  members: BankMember[]
}

export interface BankSnapshotQuestionData {
  type: QuestionType
  subjects: string[]
  difficulty: string
  tags: string[]
  text: string
  options?: string[] | null
  answer?: string | string[]
  hasLatex?: boolean
  source?: string | null
  essayBlankSpace?: { lines: number; lineHeight: number } | null
  images?: unknown[]
  scoreWeight?: number
}

export interface BankSnapshotItem {
  publicId: string
  data: BankSnapshotQuestionData
}

export interface BankSnapshot {
  version: number
  visibility: BankVisibility
  publishedAt: string
  bank: { publicId: string; name: string; description: string }
  items: BankSnapshotItem[]
}

export interface BankVersionSummary {
  id: number
  publicId: string
  version: number
  createdBy?: BankUserRef | null
  createdAt: string
  withdrawnAt?: string | null
  isActive: boolean
}

export interface BankPublication {
  id: number
  publicId: string
  bankId: number
  version: number
  state: BankSnapshot
  createdBy?: BankUserRef | null
  createdAt: string
  withdrawnAt?: string | null
}

export interface BankSubscription {
  bankId: number
  userId: number
  version?: number | null
  createdAt: string
  updatedAt: string
}

export interface PublicBankSummary {
  publicId: string
  name: string
  description: string
  owner?: BankUserRef | null
  version: number
  publishedAt: string
  itemCount: number
  subscriberCount: number
}

export interface PublicBankDetail extends PublicBankSummary {
  state: BankSnapshot
}

export interface BankCreatePayload {
  name: string
  description?: string
  visibility?: BankVisibility
}

export interface BankUpdatePayload {
  name?: string
  description?: string
  visibility?: BankVisibility
}

export interface BankItemAddPayload {
  questionIds: string[]
}

export interface BankMemberCreatePayload {
  username: string
  role: BankRole
}

export interface BankMemberUpdatePayload {
  role: BankRole
}

export interface BankForkPayload {
  version?: number
}

export interface BankListQuery {
  q?: string
  visibility?: BankVisibility
  scope?: BankListScope
}
