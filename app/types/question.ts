export type QuestionType = 'choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
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
  type: QuestionType
  subject: string
  difficulty: QuestionDifficulty
  tags: string[]
  text: string
  options?: string[]
  answer: string
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
  subject?: string
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

export interface QuestionFormInput extends Omit<Question, 'id' | 'hasLatex'> {
  hasLatex?: boolean
}
