import type { ApiErrorInfo } from '~/utils/apiError'
import type { BankVisibility, QuestionBank } from '~/types/bank'

export type BankSubscriptionState = 'subscribed' | 'not-subscribed'

export function canManageBank (bank: Pick<QuestionBank, 'accessRole'> | null) {
  return bank?.accessRole === 'owner' || bank?.accessRole === 'admin'
}

export function canEditBank (bank: Pick<QuestionBank, 'accessRole'> | null) {
  return canManageBank(bank) || bank?.accessRole === 'editor'
}

export function canPublishBank (bank: Pick<QuestionBank, 'accessRole' | 'version' | 'itemCount'> | null) {
  return canManageBank(bank)
}

export function canWithdrawBank (bank: Pick<QuestionBank, 'accessRole' | 'version'> | null) {
  return canManageBank(bank) && Boolean(bank?.version)
}

export function canChangeVisibility (bank: Pick<QuestionBank, 'accessRole'> | null) {
  return bank?.accessRole === 'owner'
}

export function visibilityOptions (): { value: BankVisibility; label: string }[] {
  return [
    { value: 'private', label: 'Private' },
    { value: 'team', label: 'Team' },
    { value: 'public', label: 'Public' }
  ]
}

export function visibilityLabel (visibility: BankVisibility): string {
  return visibilityOptions().find(option => option.value === visibility)?.label ?? visibility
}

export function subscriptionStateForBank (
  bank: Pick<QuestionBank, 'accessRole' | 'visibility'> | null,
  subscribed: boolean
): BankSubscriptionState {
  if (subscribed) return 'subscribed'
  return 'not-subscribed'
}

export function isBankItemConflict (error: ApiErrorInfo | unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'BANK_ITEM_EXISTS'
}

export function isBankAlreadyPublished (error: ApiErrorInfo | unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'BANK_ALREADY_PUBLISHED'
}

export function isBankNotPublished (error: ApiErrorInfo | unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'BANK_NOT_PUBLISHED'
}
