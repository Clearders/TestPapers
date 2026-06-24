import type { ApiPagination, PaginatedData } from '~/types/api'
import type { CorrectionCategory, CorrectionStatus, Question, QuestionCorrection, QuestionEntity, QuestionFormInput, QuestionQueryParams, QuestionRevision } from '~/types/question'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeQuestion,
  toQuestionPayload
} from '~/domain/questions'
import { apiErrorMessage } from '~/utils/apiError'
import { readFileAsBase64Payload } from '~/utils/fileData'

export type { CorrectionCategory, CorrectionStatus, EssayBlankSpace, Question, QuestionCorrection, QuestionEntity, QuestionFormInput, QuestionImage, QuestionQueryParams, QuestionRevision } from '~/types/question'

type RefState<T> = { value: T }
type QuestionUpdatePayload = Partial<Omit<Question, 'id' | 'publicId' | 'createdAt' | 'updatedAt' | 'ownerId'>>

const DEFAULT_QUESTION_QUERY = {
  includeAnswer: true,
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

function upsertQuestion (state: RefState<Question[]>, question: Question) {
  const existingIndex = state.value.findIndex(item => item.publicId === question.publicId)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1)
  state.value.unshift(question)
}

function replaceQuestion (state: RefState<Question[]>, question: Question) {
  const existingIndex = state.value.findIndex(item => item.publicId === question.publicId)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1, question)
}

function removeQuestionByPublicId (state: RefState<Question[]>, publicId: string) {
  const existingIndex = state.value.findIndex(question => question.publicId === publicId)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1)
}


export function useQuestionBank () {
  const questionRequestSequence = useState<number>('question-request-sequence', () => 0)
  const myQuestionRequestSequence = useState<number>('my-question-request-sequence', () => 0)
  const questions = useState<Question[]>('question-bank', () => [])
  const myQuestions = useState<Question[]>('my-question-bank', () => [])
  const isLoading = useState<boolean>('question-bank-loading', () => false)
  const isLoadingMine = useState<boolean>('my-question-bank-loading', () => false)
  const error = useState<string>('question-bank-error', () => '')
  const questionPagination = useState<ApiPagination>('question-bank-pagination', () => ({ page: 1, pageSize: 20, total: 0, totalPages: 0 }))
  const myQuestionPagination = useState<ApiPagination>('my-question-bank-pagination', () => ({ page: 1, pageSize: 20, total: 0, totalPages: 0 }))
  const availableSubjects = useState<string[]>('meta-subjects', () => [])
  const availableTags = useState<string[]>('meta-tags', () => [])
  const isLoadingMeta = useState<boolean>('meta-loading', () => false)
  const { hasPermission } = useAuth()
  const { apiFetch, getApiBase } = useApi()

  if (import.meta.client) {
    isLoading.value = false
    isLoadingMine.value = false
    isLoadingMeta.value = false
  }

  async function loadQuestionPage (
    endpoint: string,
    target: RefState<Question[]>,
    pagination: RefState<ApiPagination>,
    loading: RefState<boolean>,
    sequence: RefState<number>,
    params: QuestionQueryParams,
    errorMessage: string
  ) {
    const requestSequence = ++sequence.value
    loading.value = true
    error.value = ''
    try {
      const response = await apiFetch<PaginatedData<QuestionEntity>>(endpoint, {
        method: 'GET',
        query: {
          ...DEFAULT_QUESTION_QUERY,
          ...params
        }
      })
      const loadedQuestions = (response.data.items || []).map(item => normalizeQuestion(item))
      if (requestSequence !== sequence.value) return target.value
      target.value = loadedQuestions
      pagination.value = response.data.pagination
      return target.value
    } catch (err) {
      if (requestSequence !== sequence.value) return target.value
      error.value = apiErrorMessage(err, errorMessage)
      throw err
    } finally {
      if (requestSequence === sequence.value) loading.value = false
    }
  }

  const loadQuestions = (params: QuestionQueryParams = {}) => loadQuestionPage(
    '/questions',
    questions,
    questionPagination,
    isLoading,
    questionRequestSequence,
    params,
    'Failed to load questions.'
  )

  const loadMyQuestions = (params: QuestionQueryParams = {}) => loadQuestionPage(
    '/questions/mine',
    myQuestions,
    myQuestionPagination,
    isLoadingMine,
    myQuestionRequestSequence,
    params,
    'Failed to load your questions.'
  )

  const addQuestion = async (input: QuestionFormInput) => {
    const response = await apiFetch<QuestionEntity>('/questions', {
      method: 'POST',
      body: toQuestionPayload(input)
    })

    const normalized = normalizeQuestion(response.data)
    upsertQuestion(questions, normalized)
    upsertQuestion(myQuestions, normalized)
    return normalized
  }

  const updateQuestion = async (publicId: string, patch: QuestionUpdatePayload) => {
    const response = await apiFetch<QuestionEntity>(`/questions/${publicId}`, {
      method: 'PATCH',
      body: patch
    })

    const normalized = normalizeQuestion(response.data)
    replaceQuestion(questions, normalized)
    replaceQuestion(myQuestions, normalized)
    return normalized
  }

  const deleteQuestion = async (publicId: string) => {
    await apiFetch(`/questions/${publicId}`, {
      method: 'DELETE'
    })
    removeQuestionByPublicId(questions, publicId)
    removeQuestionByPublicId(myQuestions, publicId)
  }

  const uploadImage = async (file: File): Promise<string> => {
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
    if (!isPng) {
      throw new Error('Only PNG images are supported.')
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error('PNG image must be 30MB or smaller.')
    }

    const response = await apiFetch<{ url: string; filename: string; mimeType: string }>('/images/upload', {
      method: 'POST',
      body: {
        filename: file.name,
        data: await readFileAsBase64Payload(file),
        mimeType: file.type || 'image/png'
      }
    })

    if (response.data.url.startsWith('data:')) return response.data.url
    return new URL(response.data.url, new URL(getApiBase(), window.location.origin)).toString()
  }

  const loadMeta = async () => {
    if (isLoadingMeta.value || (availableSubjects.value.length && availableTags.value.length)) return
    isLoadingMeta.value = true
    try {
      const [subjectsRes, tagsRes] = await Promise.all([
        apiFetch<string[]>('/meta/subjects', { method: 'GET' }),
        apiFetch<string[]>('/meta/tags', { method: 'GET' })
      ])
      availableSubjects.value = subjectsRes.data
      availableTags.value = tagsRes.data
    } catch (e) {
      console.error('[QuestionBank] Failed to load meta data', e)
    } finally {
      isLoadingMeta.value = false
    }
  }

  const fetchRevisions = async (questionPublicId: string) => {
    const response = await apiFetch<QuestionRevision[]>(`/questions/${questionPublicId}/revisions`, {
      method: 'GET'
    })
    return response.data
  }

  const submitCorrection = async (questionPublicId: string, data: { category: CorrectionCategory; message: string }) => {
    const response = await apiFetch<QuestionCorrection>(`/questions/${questionPublicId}/corrections`, {
      method: 'POST',
      body: data
    })
    return response.data
  }

  const fetchCorrections = async (questionPublicId: string) => {
    const response = await apiFetch<QuestionCorrection[]>(`/questions/${questionPublicId}/corrections`, {
      method: 'GET'
    })
    return response.data
  }

  const updateCorrectionStatus = async (questionPublicId: string, correctionId: number, status: CorrectionStatus) => {
    const response = await apiFetch<QuestionCorrection>(`/questions/${questionPublicId}/corrections/${correctionId}`, {
      method: 'PATCH',
      body: { status }
    })
    return response.data
  }

  const deleteRevision = async (questionPublicId: string, revisionId: number) => {
    await apiFetch(`/questions/${questionPublicId}/revisions/${revisionId}`, {
      method: 'DELETE'
    })
  }

  const deleteCorrection = async (questionPublicId: string, correctionId: number) => {
    await apiFetch(`/questions/${questionPublicId}/corrections/${correctionId}`, {
      method: 'DELETE'
    })
  }

  const addQuestionLocally = (question: QuestionEntity, currentUserId?: number) => {
    const normalized = normalizeQuestion(question)
    upsertQuestion(questions, normalized)
    if (normalized.ownerId === currentUserId) upsertQuestion(myQuestions, normalized)
  }

  const replaceQuestionLocally = (question: QuestionEntity, currentUserId?: number) => {
    const normalized = normalizeQuestion(question)
    replaceQuestion(questions, normalized)
    if (normalized.ownerId === currentUserId) {
      upsertQuestion(myQuestions, normalized)
    } else {
      removeQuestionByPublicId(myQuestions, normalized.publicId)
    }
  }

  const removeQuestionLocally = (publicId: string) => {
    removeQuestionByPublicId(questions, publicId)
    removeQuestionByPublicId(myQuestions, publicId)
  }

  return {
    questions,
    myQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    loadQuestions,
    loadMyQuestions,
    uploadImage,
    loadMeta,
    canCreateQuestions: computed(() => hasPermission('questions:write')),
    canReadAnswers: computed(() => hasPermission('answers:read')),
    error,
    isLoading,
    isLoadingMine,
    isLoadingMeta,
    questionPagination,
    myQuestionPagination,
    availableSubjects,
    availableTags,
    fetchRevisions,
    submitCorrection,
    fetchCorrections,
    updateCorrectionStatus,
    deleteRevision,
    deleteCorrection,
    addQuestionLocally,
    replaceQuestionLocally,
    removeQuestionLocally
  }
}
