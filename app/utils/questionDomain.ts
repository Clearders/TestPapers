import type { EssayBlankSpace, Question, QuestionDifficulty, QuestionEntity, QuestionFormInput, QuestionType } from '~/types/question'

export const DEFAULT_ESSAY_BLANK_SPACE: EssayBlankSpace = {
  lines: 6,
  lineHeight: 28
}

const ESSAY_BLANK_SPACE_BOUNDS = {
  minLines: 1,
  maxLines: 20,
  minLineHeight: 20,
  maxLineHeight: 48
}

export const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: 'choice', label: 'Multiple Choice' },
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

const LATEX_DETECT_RE = /(\$\$[^$]+\$\$|\$[^$]+\$)/
const QUESTION_DIFFICULTIES = new Set<QuestionDifficulty>(DIFFICULTY_OPTIONS.map(option => option.value))
const OPTION_QUESTION_TYPES = new Set<QuestionType>(['choice', 'true_false'])

function boundedInteger (value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

export function isQuestionDifficulty (value: string): value is QuestionDifficulty {
  return QUESTION_DIFFICULTIES.has(value as QuestionDifficulty)
}

export function isOptionQuestionType (type: QuestionType) {
  return OPTION_QUESTION_TYPES.has(type)
}

export function normalizeEssayBlankSpace (blankSpace?: Partial<EssayBlankSpace> | null): EssayBlankSpace {
  return {
    lines: boundedInteger(
      blankSpace?.lines,
      DEFAULT_ESSAY_BLANK_SPACE.lines,
      ESSAY_BLANK_SPACE_BOUNDS.minLines,
      ESSAY_BLANK_SPACE_BOUNDS.maxLines
    ),
    lineHeight: boundedInteger(
      blankSpace?.lineHeight,
      DEFAULT_ESSAY_BLANK_SPACE.lineHeight,
      ESSAY_BLANK_SPACE_BOUNDS.minLineHeight,
      ESSAY_BLANK_SPACE_BOUNDS.maxLineHeight
    )
  }
}

export function getEssayBlankHeightPx (blankSpace?: Partial<EssayBlankSpace> | null) {
  const normalized = normalizeEssayBlankSpace(blankSpace)
  return normalized.lines * normalized.lineHeight
}

export function hasLatexContent (question: Partial<QuestionEntity>) {
  if (LATEX_DETECT_RE.test(question.text || '') || LATEX_DETECT_RE.test(question.answer || '')) return true
  if (!Array.isArray(question.options)) return false
  return question.options.some(option => LATEX_DETECT_RE.test(option || ''))
}

export function normalizeQuestion (question: Partial<QuestionEntity> & { id: number }): Question {
  const shouldUseEssayBlankSpace = question.type === 'essay'
  const essayBlankSpace = shouldUseEssayBlankSpace
    ? normalizeEssayBlankSpace(question.essayBlankSpace)
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

export function toQuestionPayload (input: QuestionFormInput) {
  return {
    type: input.type,
    subject: input.subject.trim(),
    difficulty: input.difficulty,
    tags: input.tags,
    text: input.text.trim(),
    options: isOptionQuestionType(input.type) ? input.options || [] : undefined,
    answer: input.answer.trim(),
    source: input.source?.trim() || undefined,
    essayBlankSpace: input.type === 'essay'
      ? normalizeEssayBlankSpace(input.essayBlankSpace)
      : undefined,
    images: input.images || [],
    scoreWeight: Math.max(0.01, Math.min(100, Number(input.scoreWeight) || 1)),
    hasLatex: input.hasLatex
  }
}

