export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface EssayBlankSpace {
  lines: number
  lineHeight: number
}

export interface QuestionImage {
  url: string
  caption?: string
}

export interface Question {
  id: number
  publicId: string
  type: QuestionType
  subjects: string[]
  difficulty: QuestionDifficulty
  tags: string[]
  text: string
  options?: string[]
  answer: string | string[]
  hasLatex: boolean
  source?: string
  essayBlankSpace?: EssayBlankSpace
  images?: QuestionImage[]
  scoreWeight: number
  ownerId?: number | null
}

export interface QuestionEntity extends Question {
  createdAt: string
  updatedAt: string
}

export interface QuestionQueryParams {
  q?: string
  subjects?: string
  difficulty?: QuestionDifficulty
  type?: QuestionType
  tags?: string
  hasLatex?: boolean
  includeAnswer?: boolean
  ownerId?: number
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface QuestionFormInput extends Omit<Question, 'id' | 'publicId' | 'hasLatex'> {
  hasLatex?: boolean
}

export type CorrectionCategory = 'wrong_answer' | 'unclear' | 'typo' | 'other'
export type CorrectionStatus = 'open' | 'accepted' | 'rejected'

export interface QuestionCorrection {
  id: number
  questionId: number
  userId: number | null
  category: CorrectionCategory
  message: string
  status: CorrectionStatus
  createdAt: string
  updatedAt: string
}

export interface QuestionRevision {
  id: number
  questionId: number
  userId: number | null
  patch: Record<string, unknown>
  changeSummary: string
  createdAt: string
}
