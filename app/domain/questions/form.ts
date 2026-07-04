import type { EssayBlankSpace, Question, QuestionDifficulty, QuestionFormInput, QuestionImage, QuestionType } from '~/types/question'

import { DEFAULT_ESSAY_BLANK_SPACE } from './constants'
import { isOptionQuestionType } from './guards'
import { clampScoreWeight, normalizeEssayBlankSpace, optionalPositiveInteger } from './normalization'

const LATEX_DETECT_RE = /(\$\$[^$]+\$\$|\$[^$]+\$)/

export interface QuestionCreateFormState {
  type: QuestionType
  subjects: string[]
  difficulty: QuestionDifficulty
  tags: string[]
  text: string
  options: string[]
  answer: string
  answerMultiple: number[]
  source: string
  essayBlankSpace: EssayBlankSpace
  scoreWeight: number
  images: QuestionImage[]
}

export interface QuestionEditFormState {
  type: QuestionType
  difficulty: QuestionDifficulty
  scoreWeight: number
  text: string
  options: string[]
  answer: string
  source: string
}

export interface TemporaryQuestionEditFormState {
  type: QuestionType
  difficulty: QuestionDifficulty
  scoreWeight: number
  marks?: number
  subjectsText: string
  tagsText: string
  text: string
  options: string[]
  answerText: string
  source: string
  essayLines: number
  essayLineHeight: number
}

type DraftEditableQuestion = Question & {
  marks?: number
  isTemporaryEdit?: boolean
  originalQuestion?: Question
}

export function createDefaultQuestionFormState (): QuestionCreateFormState {
  return {
    type: 'single_choice',
    subjects: [],
    difficulty: 'medium',
    tags: [],
    text: '',
    options: defaultChoiceOptions(),
    answer: '',
    answerMultiple: [],
    source: '',
    essayBlankSpace: { ...DEFAULT_ESSAY_BLANK_SPACE },
    scoreWeight: 1,
    images: []
  }
}

export function resetQuestionFormState (form: QuestionCreateFormState) {
  Object.assign(form, createDefaultQuestionFormState())
}

export function prepareQuestionFormForType (form: QuestionCreateFormState) {
  form.answer = ''
  form.answerMultiple = []
  form.options = optionsForQuestionType(form.type, form.options, { minOptions: 4, forceTrueFalse: true })
  if (form.type === 'essay') form.essayBlankSpace = { ...DEFAULT_ESSAY_BLANK_SPACE }
}

export function pruneInvalidQuestionFormAnswers (form: QuestionCreateFormState) {
  if (typeof form.answer === 'string' && form.answer && !form.options.includes(form.answer)) {
    form.answer = ''
  }
  form.answerMultiple = form.answerMultiple.filter(index => Boolean(form.options[index]?.trim()))
}

export function buildQuestionCreatePayload (form: QuestionCreateFormState): QuestionFormInput {
  return {
    type: form.type,
    subjects: cleanList(form.subjects),
    difficulty: form.difficulty,
    tags: cleanList(form.tags),
    text: form.text.trim(),
    options: isOptionQuestionType(form.type) ? cleanList(form.options) : undefined,
    answer: form.type === 'multiple_choice'
      ? form.answerMultiple
          .map(index => form.options[index]?.trim())
          .filter((option): option is string => Boolean(option))
      : form.answer.trim(),
    source: form.source.trim() || undefined,
    scoreWeight: clampScoreWeight(form.scoreWeight),
    essayBlankSpace: form.type === 'essay' ? normalizeEssayBlankSpace(form.essayBlankSpace) : undefined,
    images: form.images
  }
}

export function createQuestionEditFormState (question: Question): QuestionEditFormState {
  return {
    type: question.type,
    difficulty: question.difficulty,
    scoreWeight: question.scoreWeight,
    text: question.text,
    options: [...(question.options || defaultChoiceOptions())],
    answer: answerToText(question.answer),
    source: question.source || ''
  }
}

export function resetQuestionEditFormState (form: QuestionEditFormState, question: Question) {
  Object.assign(form, createQuestionEditFormState(question))
}

export function prepareQuestionEditFormForType (form: QuestionEditFormState) {
  form.options = optionsForQuestionType(form.type, form.options, { minOptions: 4 })
}

export function buildQuestionPatch (form: QuestionEditFormState): Partial<Omit<Question, 'id'>> {
  const patch: Partial<Omit<Question, 'id'>> = {
    type: form.type,
    difficulty: form.difficulty,
    scoreWeight: clampScoreWeight(form.scoreWeight),
    text: form.text.trim(),
    source: form.source.trim() || undefined
  }
  if (isOptionQuestionType(form.type)) {
    patch.options = cleanList(form.options)
    patch.answer = form.answer.trim()
  } else {
    patch.options = undefined
    patch.answer = form.answer.trim()
  }
  return patch
}

export function createTemporaryQuestionEditFormState (question: DraftEditableQuestion): TemporaryQuestionEditFormState {
  return {
    type: question.type,
    difficulty: question.difficulty,
    scoreWeight: question.scoreWeight,
    marks: question.marks,
    subjectsText: question.subjects.join(', '),
    tagsText: question.tags.join(', '),
    text: question.text,
    options: [...(question.options || (question.type === 'true_false' ? ['True', 'False'] : defaultChoiceOptions()))],
    answerText: answerToText(question.answer),
    source: question.source || '',
    essayLines: question.essayBlankSpace?.lines || DEFAULT_ESSAY_BLANK_SPACE.lines,
    essayLineHeight: question.essayBlankSpace?.lineHeight || DEFAULT_ESSAY_BLANK_SPACE.lineHeight
  }
}

export function resetTemporaryQuestionEditFormState (
  form: TemporaryQuestionEditFormState,
  question: DraftEditableQuestion
) {
  Object.assign(form, createTemporaryQuestionEditFormState(question))
}

export function prepareTemporaryQuestionFormForType (form: TemporaryQuestionEditFormState) {
  if (form.type === 'true_false' && !form.options.some(option => option.trim())) {
    form.options = ['True', 'False']
    return
  }
  form.options = optionsForQuestionType(form.type, form.options, { minOptions: 2 })
}

export function normalizeDraftQuestionTextFields (form: TemporaryQuestionEditFormState) {
  form.text = normalizeLooseText(form.text)
  form.options = form.options.map(normalizeLooseText)
  form.answerText = normalizeLooseText(form.answerText)
}

export function buildTemporaryQuestionEdit<T extends DraftEditableQuestion>(
  question: T,
  form: TemporaryQuestionEditFormState
): T {
  const text = form.text.trim()
  const options = isOptionQuestionType(form.type) ? cleanList(form.options) : undefined
  const answer = form.type === 'multiple_choice'
    ? splitAnswerList(form.answerText)
    : form.answerText.trim()

  return {
    ...question,
    type: form.type,
    difficulty: form.difficulty,
    scoreWeight: clampScoreWeight(form.scoreWeight),
    marks: optionalPositiveInteger(form.marks),
    subjects: splitCommaList(form.subjectsText),
    tags: splitCommaList(form.tagsText).map(tag => tag.toLowerCase()),
    text,
    answer,
    hasLatex: detectQuestionLatex({ text, answer, options }),
    source: form.source.trim() || undefined,
    options,
    essayBlankSpace: form.type === 'essay'
      ? normalizeEssayBlankSpace({ lines: form.essayLines, lineHeight: form.essayLineHeight })
      : undefined,
    isTemporaryEdit: true,
    originalQuestion: question.originalQuestion || originalQuestionSnapshot(question)
  }
}

export function addUniqueTrimmedValue (items: string[], value: string) {
  const item = value.trim()
  if (item && !items.includes(item)) items.push(item)
}

export function removeValue (items: string[], value: string) {
  const index = items.indexOf(value)
  if (index !== -1) items.splice(index, 1)
}

export function splitCommaList (value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function splitAnswerList (value: string) {
  return value
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function detectQuestionLatex (question: Pick<Question, 'text' | 'answer'> & { options?: string[] }) {
  const answer = Array.isArray(question.answer) ? question.answer.join(' ') : question.answer
  return LATEX_DETECT_RE.test([question.text, answer, ...(question.options || [])].join(' '))
}

function optionsForQuestionType (
  type: QuestionType,
  options: string[],
  {
    minOptions,
    forceTrueFalse = false
  }: {
    minOptions: number
    forceTrueFalse?: boolean
  }
) {
  if (type === 'true_false' && forceTrueFalse) return ['True', 'False']
  if (!isOptionQuestionType(type)) return options
  return [...options, ...Array(Math.max(0, minOptions - options.length)).fill('')].slice(0, Math.max(minOptions, options.length))
}

function defaultChoiceOptions () {
  return ['', '', '', '']
}

function cleanList (items: string[]) {
  return items.map(item => item.trim()).filter(Boolean)
}

function answerToText (answer: Question['answer']) {
  return Array.isArray(answer) ? answer.join(', ') : String(answer || '')
}

function normalizeLooseText (value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function originalQuestionSnapshot (question: DraftEditableQuestion): Question {
  return {
    id: question.id,
    publicId: question.publicId,
    type: question.type,
    subjects: [...question.subjects],
    difficulty: question.difficulty,
    tags: [...question.tags],
    text: question.text,
    ...(question.options?.length ? { options: [...question.options] } : {}),
    answer: Array.isArray(question.answer) ? [...question.answer] : question.answer,
    hasLatex: question.hasLatex,
    ...(question.source ? { source: question.source } : {}),
    ...(question.essayBlankSpace ? { essayBlankSpace: { ...question.essayBlankSpace } } : {}),
    ...(question.images?.length ? { images: question.images.map(image => ({ ...image })) } : {}),
    scoreWeight: question.scoreWeight,
    ...(typeof question.ownerId === 'number' || question.ownerId === null ? { ownerId: question.ownerId } : {})
  }
}
