import type { ApiPagination, PaginatedData } from '~/types/api'
import type { EssayBlankSpace, Question, QuestionEntity, QuestionFormInput, QuestionQueryParams } from '~/types/question'

export type { EssayBlankSpace, Question, QuestionEntity, QuestionFormInput, QuestionImage, QuestionQueryParams } from '~/types/question'

export const DEFAULT_ESSAY_BLANK_SPACE: EssayBlankSpace = {
  lines: 6,
  lineHeight: 28
}

export const QUESTION_TYPE_LABELS: Record<Question['type'], string> = {
  choice: 'Multiple Choice',
  true_false: 'True / False',
  blank: 'Fill in the Blank',
  short_answer: 'Short Answer',
  essay: 'Essay'
}

// Module-level regex to avoid recompilation
const LATEX_DETECT_RE = /(\$\$[^$]+\$\$|\$[^$]+\$)/
const MAX_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024

function hasLatexContent (question: Partial<QuestionEntity>) {
  if (LATEX_DETECT_RE.test(question.text || '') || LATEX_DETECT_RE.test(question.answer || '')) return true
  if (!Array.isArray(question.options)) return false
  return question.options.some(option => LATEX_DETECT_RE.test(option || ''))
}

function normalizeQuestion (question: Partial<QuestionEntity> & { id: number }): Question {
  const shouldUseEssayBlankSpace = question.type === 'essay'
  const essayBlankSpace = shouldUseEssayBlankSpace
    ? {
        lines: Math.max(1, Math.min(20, Number(question.essayBlankSpace?.lines) || DEFAULT_ESSAY_BLANK_SPACE.lines)),
        lineHeight: Math.max(20, Math.min(48, Number(question.essayBlankSpace?.lineHeight) || DEFAULT_ESSAY_BLANK_SPACE.lineHeight))
      }
    : undefined

  const tags = Array.isArray(question.tags) ? question.tags : []
  const options = Array.isArray(question.options) ? question.options : undefined
  const images = Array.isArray(question.images) ? question.images : []
  const scoreWeight = Math.max(0.01, Math.min(100, Number(question.scoreWeight) || 1))

  const hasLatex = typeof question.hasLatex === 'boolean'
    ? question.hasLatex
    : hasLatexContent(question)

  return {
    id: question.id,
    type: question.type as Question['type'],
    subject: question.subject || '',
    difficulty: question.difficulty as Question['difficulty'] || 'medium',
    text: question.text || '',
    answer: question.answer || '',
    source: question.source,
    tags,
    options,
    images,
    scoreWeight,
    essayBlankSpace,
    hasLatex,
    ownerId: question.ownerId ?? null
  }
}

function toPayload (input: QuestionFormInput) {
  return {
    type: input.type,
    subject: input.subject.trim(),
    difficulty: input.difficulty,
    tags: input.tags,
    text: input.text.trim(),
    options: (input.type === 'choice' || input.type === 'true_false') ? input.options || [] : undefined,
    answer: input.answer.trim(),
    source: input.source?.trim() || undefined,
    essayBlankSpace: input.type === 'essay'
      ? {
          lines: Math.max(1, Math.min(20, Number(input.essayBlankSpace?.lines) || DEFAULT_ESSAY_BLANK_SPACE.lines)),
          lineHeight: Math.max(20, Math.min(48, Number(input.essayBlankSpace?.lineHeight) || DEFAULT_ESSAY_BLANK_SPACE.lineHeight))
        }
      : undefined,
    images: input.images || [],
    scoreWeight: Math.max(0.01, Math.min(100, Number(input.scoreWeight) || 1)),
    hasLatex: input.hasLatex
  }
}

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
      body: toPayload(input)
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

  return {
    questions,
    myQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    loadQuestions,
    loadMyQuestions,
    uploadImage,
    canCreateQuestions: computed(() => hasPermission('questions:write')),
    canDeleteQuestions: computed(() => hasPermission('questions:delete')),
    canReadAnswers: computed(() => hasPermission('answers:read')),
    error,
    isLoading,
    isLoadingMine,
    questionPagination,
    myQuestionPagination
  }
}
