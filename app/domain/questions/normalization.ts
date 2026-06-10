import type { EssayBlankSpace, Question, QuestionEntity, QuestionFormInput } from '~/types/question'

import { DEFAULT_ESSAY_BLANK_SPACE, ESSAY_BLANK_SPACE_BOUNDS } from './constants'
import { isOptionQuestionType } from './guards'

const LATEX_DETECT_RE = /(\$\$[^$]+\$\$|\$[^$]+\$)/

function boundedInteger (value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(parsed)))
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
  const answerText = typeof question.answer === 'string' ? question.answer : (Array.isArray(question.answer) ? question.answer.join(' ') : '')
  if (LATEX_DETECT_RE.test(question.text || '') || LATEX_DETECT_RE.test(answerText)) return true
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
    answer: typeof input.answer === 'string' ? input.answer.trim() : input.answer,
    source: input.source?.trim() || undefined,
    essayBlankSpace: input.type === 'essay'
      ? normalizeEssayBlankSpace(input.essayBlankSpace)
      : undefined,
    images: input.images || [],
    scoreWeight: Math.max(0.01, Math.min(100, Number(input.scoreWeight) || 1)),
    hasLatex: input.hasLatex
  }
}

