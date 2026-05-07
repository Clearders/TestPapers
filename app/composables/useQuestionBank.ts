export interface EssayBlankSpace {
  lines: number
  lineHeight: number
}

export interface Question {
  id: number
  type: 'choice' | 'blank' | 'essay'
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options?: string[]
  answer: string
  hasLatex: boolean
  source?: string
  essayBlankSpace?: EssayBlankSpace
}

interface QuestionEntity extends Question {
  createdAt: string
  updatedAt: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: {
    requestId?: string
  }
}

interface QuestionListData {
  items: QuestionEntity[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface QuestionQueryParams {
  q?: string
  subject?: string
  difficulty?: Question['difficulty']
  type?: Question['type']
  tags?: string
  hasLatex?: boolean
  includeAnswer?: boolean
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const DEFAULT_ESSAY_BLANK_SPACE: EssayBlankSpace = {
  lines: 6,
  lineHeight: 28
}

function getApiBase () {
  const config = useRuntimeConfig()
  return config.public.apiBase || 'http://127.0.0.1:8010/api/v1'
}

function normalizeQuestion (question: Partial<QuestionEntity> & { id: number }): Question {
  const shouldUseEssayBlankSpace = question.type === 'essay'
  const essayBlankSpace = shouldUseEssayBlankSpace
    ? {
        lines: Math.max(1, Math.min(20, Number(question.essayBlankSpace?.lines) || DEFAULT_ESSAY_BLANK_SPACE.lines)),
        lineHeight: Math.max(20, Math.min(48, Number(question.essayBlankSpace?.lineHeight) || DEFAULT_ESSAY_BLANK_SPACE.lineHeight))
      }
    : undefined

  return {
    ...question,
    answer: question.answer || '',
    tags: Array.isArray(question.tags) ? question.tags : [],
    options: Array.isArray(question.options) ? question.options : undefined,
    essayBlankSpace,
    hasLatex: typeof question.hasLatex === 'boolean'
      ? question.hasLatex
      : /(\$\$[^$]+\$\$|\$[^$]+\$)/.test(`${question.text || ''}${question.answer || ''}${question.options?.join('') || ''}`)
  }
}

function toPayload (input: Omit<Question, 'id' | 'hasLatex'> & { hasLatex?: boolean }) {
  return {
    type: input.type,
    subject: input.subject.trim(),
    difficulty: input.difficulty,
    tags: [...input.tags],
    text: input.text.trim(),
    options: input.type === 'choice' ? [...(input.options || [])] : undefined,
    answer: input.answer.trim(),
    source: input.source?.trim() || undefined,
    essayBlankSpace: input.type === 'essay'
      ? {
          lines: Math.max(1, Math.min(20, Number(input.essayBlankSpace?.lines) || DEFAULT_ESSAY_BLANK_SPACE.lines)),
          lineHeight: Math.max(20, Math.min(48, Number(input.essayBlankSpace?.lineHeight) || DEFAULT_ESSAY_BLANK_SPACE.lineHeight))
        }
      : undefined,
    hasLatex: input.hasLatex
  }
}

async function apiFetch<T> (path: string, options: any = {}) {
  const { authHeaders } = useAuth()
  return await $fetch<ApiEnvelope<T>>(path, {
    baseURL: getApiBase(),
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  })
}

export function useQuestionBank () {
  const questions = useState<Question[]>('question-bank', () => [])
  const isLoading = useState<boolean>('question-bank-loading', () => false)
  const { hasPermission } = useAuth()

  const loadQuestions = async (params: QuestionQueryParams = {}) => {
    if (isLoading.value) return questions.value

    isLoading.value = true
    try {
      const response = await apiFetch<QuestionListData>('/questions', {
        method: 'GET',
        query: {
          includeAnswer: true,
          page: 1,
          pageSize: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          ...params
        }
      })
      questions.value = (response.data.items || []).map((item) => normalizeQuestion(item))
      return questions.value
    } finally {
      isLoading.value = false
    }
  }

  const addQuestion = async (input: Omit<Question, 'id' | 'hasLatex'> & { hasLatex?: boolean }) => {
    const response = await apiFetch<QuestionEntity>('/questions', {
      method: 'POST',
      body: toPayload(input)
    })

    const normalized = normalizeQuestion(response.data)
    questions.value = [normalized, ...questions.value.filter(question => question.id !== normalized.id)]
    return normalized
  }

  const updateQuestion = async (id: number, patch: Partial<Omit<Question, 'id'>>) => {
    const response = await apiFetch<QuestionEntity>(`/questions/${id}`, {
      method: 'PATCH',
      body: patch
    })

    const normalized = normalizeQuestion(response.data)
    questions.value = questions.value.map(question => question.id === id ? normalized : question)
    return normalized
  }

  const deleteQuestion = async (id: number) => {
    await apiFetch(`/questions/${id}`, {
      method: 'DELETE'
    })
    questions.value = questions.value.filter(question => question.id !== id)
  }

  return {
    questions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    loadQuestions,
    canCreateQuestions: computed(() => hasPermission('questions:write')),
    canDeleteQuestions: computed(() => hasPermission('questions:delete')),
    canReadAnswers: computed(() => hasPermission('answers:read')),
    isLoading
  }
}
