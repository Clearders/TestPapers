import type { QuestionDifficulty, QuestionType } from '~/types/question'

import { DIFFICULTY_OPTIONS } from './constants'

const QUESTION_DIFFICULTIES = new Set<QuestionDifficulty>(DIFFICULTY_OPTIONS.map(option => option.value))
const OPTION_QUESTION_TYPES = new Set<QuestionType>(['single_choice', 'multiple_choice', 'true_false'])

export function isQuestionDifficulty (value: string): value is QuestionDifficulty {
  return QUESTION_DIFFICULTIES.has(value as QuestionDifficulty)
}

export function isOptionQuestionType (type: QuestionType) {
  return OPTION_QUESTION_TYPES.has(type)
}

