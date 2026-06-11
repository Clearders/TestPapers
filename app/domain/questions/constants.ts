import type { EssayBlankSpace, QuestionDifficulty, QuestionType } from '~/types/question'

export const DEFAULT_ESSAY_BLANK_SPACE: EssayBlankSpace = {
  lines: 6,
  lineHeight: 28
}

const ESSAY_BLANK_SPACE_BOUNDS = {
  minLines: 1,
  maxLines: 20,
  minLineHeight: 20,
  maxLineHeight: 48
} as const

export const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' }
]

export const QUESTION_TYPE_ORDER = QUESTION_TYPE_OPTIONS.map(option => option.value)

export const QUESTION_TYPE_LABELS = QUESTION_TYPE_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label
  return labels
}, {} as Record<QuestionType, string>)

export const DIFFICULTY_OPTIONS: Array<{ value: QuestionDifficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
]

export const LATEX_QUICK_REFERENCE = [
  { label: 'Fraction', code: '\\frac{a}{b}', formula: '\\frac{a}{b}' },
  { label: 'Square root', code: '\\sqrt{x}', formula: '\\sqrt{x}' },
  { label: 'Power', code: 'x^{2}', formula: 'x^{2}' },
  { label: 'Subscript', code: 'x_{n}', formula: 'x_{n}' },
  { label: 'Integral', code: '\\int_a^b f\\,dx', formula: '\\int_a^b f\\,dx' },
  { label: 'Sum', code: '\\sum_{i=1}^n i', formula: '\\sum_{i=1}^n i' },
  { label: 'Infinity', code: '\\infty', formula: '\\infty' },
  { label: 'Greek', code: '\\alpha, \\beta', formula: '\\alpha, \\beta' }
]

export const MAX_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024

