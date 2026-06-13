import type { ApiPagination, PaginatedData } from '~/types/api'
import type { CorrectionCategory, CorrectionStatus, Question, QuestionCorrection, QuestionEntity, QuestionFormInput, QuestionQueryParams, QuestionRevision } from '~/types/question'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeQuestion,
  toQuestionPayload
} from '~/domain/questions'

export type { CorrectionCategory, CorrectionStatus, EssayBlankSpace, Question, QuestionCorrection, QuestionEntity, QuestionFormInput, QuestionImage, QuestionQueryParams, QuestionRevision } from '~/types/question'

function upsertQuestion (state: { value: Question[] }, question: Question) {
  const existingIndex = state.value.findIndex(item => item.id === question.id)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1)
  state.value.unshift(question)
}

function replaceQuestion (state: { value: Question[] }, question: Question) {
  const existingIndex = state.value.findIndex(item => item.id === question.id)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1, question)
}

function removeQuestionById (state: { value: Question[] }, id: number) {
  const existingIndex = state.value.findIndex(question => question.id === id)
  if (existingIndex !== -1) state.value.splice(existingIndex, 1)
}

export function useQuestionBank () {
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

  const loadQuestions = async (params: QuestionQueryParams = {}) => {
    isLoading.value = true
    error.value = ''
    try {
      const response = await apiFetch<PaginatedData<QuestionEntity>>('/questions', {
        method: 'GET',
        query: {
          includeAnswer: true,
          page: 1,
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          ...params
        }
      })
      questions.value = (response.data.items || []).map((item) => normalizeQuestion(item))
      questionPagination.value = response.data.pagination
      return questions.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load questions.'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const loadMyQuestions = async (params: QuestionQueryParams = {}) => {
    isLoadingMine.value = true
    error.value = ''
    try {
      const response = await apiFetch<PaginatedData<QuestionEntity>>('/questions/mine', {
        method: 'GET',
        query: {
          includeAnswer: true,
          page: 1,
          pageSize: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          ...params
        }
      })
      myQuestions.value = (response.data.items || []).map((item) => normalizeQuestion(item))
      myQuestionPagination.value = response.data.pagination
      return myQuestions.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load your questions.'
      throw err
    } finally {
      isLoadingMine.value = false
    }
  }

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

  const updateQuestion = async (publicId: string, patch: Partial<Omit<Question, 'id'>>) => {
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
    const idx = questions.value.findIndex(q => q.publicId === publicId)
    if (idx !== -1) {
      const q = questions.value[idx]
      if (q) removeQuestionById(questions, q.id)
    }
    const myIdx = myQuestions.value.findIndex(q => q.publicId === publicId)
    if (myIdx !== -1) {
      const q = myQuestions.value[myIdx]
      if (q) removeQuestionById(myQuestions, q.id)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
    if (!isPng) {
      throw new Error('Only PNG images are supported.')
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error('PNG image must be 30MB or smaller.')
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.slice(result.indexOf(',') + 1))
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

    const response = await apiFetch<{ url: string; filename: string; mimeType: string }>('/images/upload', {
      method: 'POST',
      body: {
        filename: file.name,
        data: base64,
        mimeType: file.type || 'image/png'
      }
    })

    if (response.data.url.startsWith('data:')) return response.data.url
    return new URL(response.data.url, new URL(getApiBase(), window.location.origin)).toString()
  }

  const loadMeta = async () => {
    if (isLoadingMeta.value) return
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

  const addQuestionLocally = (question: QuestionEntity) => {
    const normalized = normalizeQuestion(question)
    upsertQuestion(questions, normalized)
    upsertQuestion(myQuestions, normalized)
  }

  const replaceQuestionLocally = (question: QuestionEntity) => {
    const normalized = normalizeQuestion(question)
    replaceQuestion(questions, normalized)
    replaceQuestion(myQuestions, normalized)
  }

  const removeQuestionLocally = (questionId: number) => {
    removeQuestionById(questions, questionId)
    removeQuestionById(myQuestions, questionId)
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
