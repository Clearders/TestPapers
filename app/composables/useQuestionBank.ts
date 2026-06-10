import type { ApiPagination, PaginatedData } from '~/types/api'
import type { Question, QuestionEntity, QuestionFormInput, QuestionQueryParams } from '~/types/question'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeQuestion,
  toQuestionPayload
} from '~/domain/questions'

export type { EssayBlankSpace, Question, QuestionEntity, QuestionFormInput, QuestionImage, QuestionQueryParams } from '~/types/question'

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

  const loadQuestions = async (params: QuestionQueryParams = {}) => {
    if (isLoading.value) return

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

  const updateQuestion = async (id: number, patch: Partial<Omit<Question, 'id'>>) => {
    const response = await apiFetch<QuestionEntity>(`/questions/${id}`, {
      method: 'PATCH',
      body: patch
    })

    const normalized = normalizeQuestion(response.data)
    replaceQuestion(questions, normalized)
    replaceQuestion(myQuestions, normalized)
    return normalized
  }

  const deleteQuestion = async (id: number) => {
    await apiFetch(`/questions/${id}`, {
      method: 'DELETE'
    })
    removeQuestionById(questions, id)
    removeQuestionById(myQuestions, id)
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
    } catch {
    } finally {
      isLoadingMeta.value = false
    }
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
    canDeleteQuestions: computed(() => hasPermission('questions:delete')),
    canReadAnswers: computed(() => hasPermission('answers:read')),
    error,
    isLoading,
    isLoadingMine,
    isLoadingMeta,
    questionPagination,
    myQuestionPagination,
    availableSubjects,
    availableTags
  }
}
