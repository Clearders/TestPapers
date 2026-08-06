import type {
  BankForkPayload,
  BankItemAddPayload,
  BankMemberCreatePayload,
  BankMemberUpdatePayload,
  BankPublication,
  BankSubscription,
  BankUpdatePayload,
  BankVersionSummary,
  QuestionBank
} from '~/types/bank'
import type { QuestionEntity } from '~/types/question'
import { apiErrorMessage } from '~/utils/apiError'

export function useQuestionBanks () {
  const banks = useState<QuestionBank[]>('shared-banks', () => [])
  const isLoading = useState<boolean>('shared-banks-loading', () => false)
  const error = useState<string>('shared-banks-error', () => '')
  const { hasPermission } = useAuth()
  const { apiFetch } = useApi()

  function upsertBank (bank: QuestionBank) {
    const existingIndex = banks.value.findIndex(item => item.publicId === bank.publicId)
    if (existingIndex !== -1) banks.value.splice(existingIndex, 1, bank)
    else banks.value.unshift(bank)
  }

  function removeBank (publicId: string) {
    const existingIndex = banks.value.findIndex(item => item.publicId === publicId)
    if (existingIndex !== -1) banks.value.splice(existingIndex, 1)
  }

  async function run<T> (operation: () => Promise<T>, errorMessage: string): Promise<T> {
    error.value = ''
    try {
      return await operation()
    } catch (err) {
      error.value = apiErrorMessage(err, errorMessage)
      throw err
    }
  }

  async function loadBanks () {
    return run(async () => {
      isLoading.value = true
      try {
        const response = await apiFetch<QuestionBank[]>('/banks', { method: 'GET' })
        banks.value = response.data || []
        return banks.value
      } finally {
        isLoading.value = false
      }
    }, 'Failed to load question banks.')
  }

  async function createBank (payload: { name: string; description?: string; visibility?: string }) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>('/banks', { method: 'POST', body: payload })
      upsertBank(response.data)
      return response.data
    }, 'Failed to create the question bank.')
  }

  async function getBank (publicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}`, { method: 'GET' })
      upsertBank(response.data)
      return response.data
    }, 'Failed to load the question bank.')
  }

  async function updateBank (publicId: string, patch: BankUpdatePayload) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}`, { method: 'PATCH', body: patch })
      upsertBank(response.data)
      return response.data
    }, 'Failed to update the question bank.')
  }

  async function deleteBank (publicId: string) {
    return run(async () => {
      await apiFetch(`/banks/${publicId}`, { method: 'DELETE' })
      removeBank(publicId)
    }, 'Failed to delete the question bank.')
  }

  async function listQuestions (publicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionEntity[]>(`/banks/${publicId}/questions`, { method: 'GET' })
      return response.data || []
    }, 'Failed to load bank questions.')
  }

  async function addItems (publicId: string, payload: BankItemAddPayload) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/items`, { method: 'POST', body: payload })
      upsertBank(response.data)
      return response.data
    }, 'Failed to add questions to the bank.')
  }

  async function removeItem (publicId: string, questionPublicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/items/${questionPublicId}`, { method: 'DELETE' })
      upsertBank(response.data)
      return response.data
    }, 'Failed to remove the question from the bank.')
  }

  async function addMember (publicId: string, payload: BankMemberCreatePayload) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/members`, { method: 'POST', body: payload })
      upsertBank(response.data)
      return response.data
    }, 'Failed to add the member.')
  }

  async function updateMemberRole (publicId: string, userPublicId: string, payload: BankMemberUpdatePayload) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/members/${userPublicId}`, { method: 'PATCH', body: payload })
      upsertBank(response.data)
      return response.data
    }, 'Failed to update the member role.')
  }

  async function removeMember (publicId: string, userPublicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/members/${userPublicId}`, { method: 'DELETE' })
      upsertBank(response.data)
      return response.data
    }, 'Failed to remove the member.')
  }

  async function publishBank (publicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/publish`, { method: 'POST' })
      upsertBank(response.data)
      return response.data
    }, 'Failed to publish the bank.')
  }

  async function withdrawBank (publicId: string) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/withdraw`, { method: 'POST' })
      upsertBank(response.data)
      return response.data
    }, 'Failed to withdraw the bank.')
  }

  async function listVersions (publicId: string) {
    return run(async () => {
      const response = await apiFetch<BankVersionSummary[]>(`/banks/${publicId}/versions`, { method: 'GET' })
      return response.data || []
    }, 'Failed to load bank versions.')
  }

  async function getVersion (publicId: string, version: number) {
    return run(async () => {
      const response = await apiFetch<BankPublication>(`/banks/${publicId}/versions/${version}`, { method: 'GET' })
      return response.data
    }, 'Failed to load the bank version.')
  }

  async function forkBank (publicId: string, payload: BankForkPayload = {}) {
    return run(async () => {
      const response = await apiFetch<QuestionBank>(`/banks/${publicId}/fork`, { method: 'POST', body: payload })
      upsertBank(response.data)
      return response.data
    }, 'Failed to fork the bank.')
  }

  async function subscribe (publicId: string) {
    return run(async () => {
      const response = await apiFetch<BankSubscription>(`/banks/${publicId}/subscribe`, { method: 'POST' })
      return response.data
    }, 'Failed to subscribe to the bank.')
  }

  async function unsubscribe (publicId: string) {
    return run(async () => {
      await apiFetch(`/banks/${publicId}/subscribe`, { method: 'DELETE' })
    }, 'Failed to unsubscribe from the bank.')
  }

  return {
    banks,
    isLoading,
    error,
    canCreateBanks: computed(() => hasPermission('banks:write')),
    canPublish: computed(() => hasPermission('banks:publish')),
    canSubscribe: computed(() => hasPermission('banks:subscribe')),
    loadBanks,
    createBank,
    getBank,
    updateBank,
    deleteBank,
    listQuestions,
    addItems,
    removeItem,
    addMember,
    updateMemberRole,
    removeMember,
    publishBank,
    withdrawBank,
    listVersions,
    getVersion,
    forkBank,
    subscribe,
    unsubscribe
  }
}
