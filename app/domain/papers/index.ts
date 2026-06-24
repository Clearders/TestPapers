import type { ExportMode, GenerationDiagnostics, GenerationFormState, LayoutDensity } from '~/types/generation'
import type { Question, QuestionDifficulty, QuestionEntity, QuestionImage, QuestionType } from '~/types/question'
import {
  DEFAULT_ESSAY_BLANK_SPACE,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_ORDER,
  boundedNumber,
  normalizeEssayBlankSpace,
  normalizeQuestion,
  optionalPositiveInteger
} from '~/domain/questions'

export type BankMode = 'all' | 'mine'
export type PaperQuestion = Question & { marks?: number; orderNo?: number }
export type ApiPaperQuestion = Partial<QuestionEntity> & { id: number; marks?: number | null; orderNo?: number | null }

export interface PaperState {
  title: string
  subject: string
  duration: number
  totalMarks: number
  questions: PaperQuestion[]
}

export interface PaperMetadataPayload {
  title: string
  subject: string
  duration: number
  totalMarks: number
}

export interface PaperQuestionRefPayload {
  questionPublicId: string
  orderNo: number
  marks?: number
}

export interface PaperCreatePayload extends PaperMetadataPayload {
  questions: PaperQuestionRefPayload[]
}

export interface PaperGeneratePayload {
  title: string
  duration: number
  totalMarks: number
  difficultyCoefficient: number
  questionTypes: Array<{ questionType: QuestionType; count: number }>
  ownQuestionsOnly: boolean
  subjects: string[]
  requiredTags?: string[]
  preferredTags?: string[]
}

export interface GeneratedPaperResponse {
  paper: {
    id: number
    publicId: string
    title: string
    subject: string
    duration: number
    totalMarks: number
    questions: ApiPaperQuestion[]
  }
  diagnostics: GenerationDiagnostics
}

export interface PaperEntityResponse {
  id: number
  publicId: string
  title: string
  subject: string
  duration: number
  totalMarks: number
}

export interface WorkspaceDraft {
  version: 1
  paper: PaperState
  generationForm: GenerationFormState
  exportMode: ExportMode
  layoutDensity: LayoutDensity
  includeAnswersInExport: boolean
  savedPaperId: string | null
  savedPaperSignature: string
  generationDiagnostics: GenerationDiagnostics | null
}

export type BuildWorkspaceDraftInput = Omit<WorkspaceDraft, 'version'>

export const DEFAULT_PAPER = {
  duration: 60,
  totalMarks: 100
} as const

export const WORKSPACE_DRAFT_PREFIX = 'testpapers.workspaceDraft.v1'
export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const QUESTION_TYPE_SET = new Set<QuestionType>(QUESTION_TYPE_ORDER)
const QUESTION_DIFFICULTY_SET = new Set<QuestionDifficulty>(DIFFICULTY_OPTIONS.map(option => option.value))

export function createDefaultPaper (): PaperState {
  return {
    title: '',
    subject: '',
    duration: DEFAULT_PAPER.duration,
    totalMarks: DEFAULT_PAPER.totalMarks,
    questions: []
  }
}

export function createDefaultGenerationForm (): GenerationFormState {
  return {
    difficultyCoefficient: 0.5,
    questionTypes: ['single_choice'],
    typeCounts: { single_choice: 5 },
    subjects: [],
    requiredTagsStr: '',
    requiredTags: [],
    preferredTagsStr: '',
    preferredTags: [],
    customTagInput: ''
  }
}

export function parseBankMode (value: unknown): BankMode {
  return value === 'mine' ? 'mine' : 'all'
}

export function parseQuestionDifficulty (value: unknown): QuestionDifficulty | '' {
  return typeof value === 'string' && QUESTION_DIFFICULTY_SET.has(value as QuestionDifficulty)
    ? value as QuestionDifficulty
    : ''
}

export function toPositiveInteger (value: unknown, fallback: number, min = 1) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.round(parsed)) : fallback
}

export function cloneData<T> (value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T
}

export function clonePaperQuestion (question: Question): PaperQuestion {
  return cloneData(question) as PaperQuestion
}

export function buildPaperMetadataPayload (paper: PaperState): PaperMetadataPayload {
  return {
    title: paper.title.trim(),
    subject: paper.subject.trim(),
    duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
    totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks)
  }
}

export function buildPaperPayload (paper: PaperState): PaperCreatePayload {
  return {
    ...buildPaperMetadataPayload(paper),
    questions: paper.questions.map((question, index) => {
      const marks = optionalPositiveInteger(question.marks)
      return {
        questionPublicId: question.publicId,
        orderNo: index + 1,
        ...(marks ? { marks } : {})
      }
    })
  }
}

export function getPaperSignature (paper: PaperState) {
  return JSON.stringify(buildPaperPayload(paper))
}

export function buildPaperGeneratePayload (paper: PaperState, generationForm: GenerationFormState, bankMode: BankMode): PaperGeneratePayload | null {
  if (!paper.title.trim() || !generationForm.subjects.length) return null

  return {
    title: paper.title.trim(),
    subjects: [...generationForm.subjects],
    duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
    totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks),
    difficultyCoefficient: boundedNumber(generationForm.difficultyCoefficient, 0.5, 0, 1),
    questionTypes: generationForm.questionTypes.map(type => ({
      questionType: type,
      count: generationForm.typeCounts[type] || 1
    })),
    ownQuestionsOnly: bankMode === 'mine',
    ...(generationForm.requiredTags.length ? { requiredTags: generationForm.requiredTags } : {}),
    ...(generationForm.preferredTags.length ? { preferredTags: generationForm.preferredTags } : {})
  }
}

export function normalizePaperQuestion (question: ApiPaperQuestion): PaperQuestion {
  const normalized = normalizeQuestion(question)
  return {
    ...normalized,
    marks: optionalPositiveInteger(question.marks),
    orderNo: optionalPositiveInteger(question.orderNo)
  }
}

export function getWorkspaceDraftKey (userId?: number | null) {
  return userId ? `${WORKSPACE_DRAFT_PREFIX}.${userId}` : ''
}

export function buildWorkspaceDraft (input: BuildWorkspaceDraftInput): WorkspaceDraft {
  return {
    version: 1,
    paper: cloneData(input.paper),
    generationForm: cloneData(input.generationForm),
    exportMode: input.exportMode,
    layoutDensity: input.layoutDensity,
    includeAnswersInExport: input.includeAnswersInExport,
    savedPaperId: input.savedPaperId,
    savedPaperSignature: input.savedPaperSignature,
    generationDiagnostics: input.generationDiagnostics ? cloneData(input.generationDiagnostics) : null
  }
}

export function validateWorkspaceDraft (value: unknown): WorkspaceDraft | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.paper)) return null
  const questions = Array.isArray(value.paper.questions)
    ? value.paper.questions.map(validateDraftQuestion).filter((question): question is PaperQuestion => question !== null)
    : []

  return {
    version: 1,
    paper: {
      title: typeof value.paper.title === 'string' ? value.paper.title : '',
      subject: typeof value.paper.subject === 'string' ? value.paper.subject : '',
      duration: toPositiveInteger(value.paper.duration, DEFAULT_PAPER.duration),
      totalMarks: toPositiveInteger(value.paper.totalMarks, DEFAULT_PAPER.totalMarks),
      questions
    },
    generationForm: validateGenerationFormDraft(value.generationForm),
    exportMode: value.exportMode === 'categorized' ? 'categorized' : 'paper',
    layoutDensity: layoutDensityFromHeader(typeof value.layoutDensity === 'string' ? value.layoutDensity : null) || 'auto',
    includeAnswersInExport: Boolean(value.includeAnswersInExport),
    savedPaperId: typeof value.savedPaperId === 'string' && value.savedPaperId.trim() ? value.savedPaperId : null,
    savedPaperSignature: typeof value.savedPaperSignature === 'string' ? value.savedPaperSignature : '',
    generationDiagnostics: isRecord(value.generationDiagnostics) ? value.generationDiagnostics as unknown as GenerationDiagnostics : null
  }
}

export function layoutDensityFromHeader (value: string | null): LayoutDensity | null {
  if (value === 'normal' || value === 'compact' || value === 'dense' || value === 'auto') return value
  return null
}

export function filenameFromDisposition (disposition: string | null, fallbackTitle: string) {
  const fallback = `${fallbackTitle.trim() || 'examination-paper'}.docx`
  if (!disposition) return fallback

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return encodedMatch[1]
    }
  }

  return disposition.match(/filename="([^"]+)"/i)?.[1] || fallback
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuestionType (value: unknown): value is QuestionType {
  return typeof value === 'string' && QUESTION_TYPE_SET.has(value as QuestionType)
}

function isQuestionDifficulty (value: unknown): value is QuestionDifficulty {
  return typeof value === 'string' && QUESTION_DIFFICULTY_SET.has(value as QuestionDifficulty)
}

function stringArrayFromDraft (value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function optionalStringArrayFromDraft (value: unknown) {
  return Array.isArray(value) ? stringArrayFromDraft(value) : undefined
}

function numberFromDraft (value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function validateDraftQuestion (value: unknown): PaperQuestion | null {
  if (!isRecord(value)) return null
  const id = Number(value.id)
  if (!Number.isFinite(id) || typeof value.publicId !== 'string' || !value.publicId.trim()) return null
  if (!isQuestionType(value.type) || !isQuestionDifficulty(value.difficulty)) return null
  if (typeof value.text !== 'string') return null

  const options = optionalStringArrayFromDraft(value.options)
  const marks = optionalPositiveInteger(value.marks)
  const orderNo = optionalPositiveInteger(value.orderNo)
  const images = questionImagesFromDraft(value.images)
  const essayBlankSpace = isRecord(value.essayBlankSpace)
    ? normalizeEssayBlankSpace(value.essayBlankSpace)
    : value.type === 'essay'
      ? { ...DEFAULT_ESSAY_BLANK_SPACE }
      : undefined

  return {
    id,
    publicId: value.publicId,
    type: value.type,
    subjects: stringArrayFromDraft(value.subjects),
    difficulty: value.difficulty,
    tags: stringArrayFromDraft(value.tags),
    text: value.text,
    ...(options ? { options } : {}),
    answer: Array.isArray(value.answer) ? stringArrayFromDraft(value.answer) : String(value.answer ?? ''),
    hasLatex: Boolean(value.hasLatex),
    ...(typeof value.source === 'string' ? { source: value.source } : {}),
    ...(essayBlankSpace ? { essayBlankSpace } : {}),
    ...(images.length ? { images } : {}),
    scoreWeight: numberFromDraft(value.scoreWeight, 1),
    ...(marks ? { marks } : {}),
    ...(orderNo ? { orderNo } : {}),
    ...(typeof value.ownerId === 'number' || value.ownerId === null ? { ownerId: value.ownerId } : {})
  }
}

function validateGenerationFormDraft (value: unknown): GenerationFormState {
  if (!isRecord(value)) return createDefaultGenerationForm()

  const questionTypes = stringArrayFromDraft(value.questionTypes).filter(isQuestionType)
  const typeCounts: Record<string, number> = {}
  if (isRecord(value.typeCounts)) {
    for (const type of QUESTION_TYPE_ORDER) {
      const count = optionalPositiveInteger(value.typeCounts[type])
      if (count) typeCounts[type] = count
    }
  }

  return {
    difficultyCoefficient: boundedNumber(value.difficultyCoefficient, 0.5, 0, 1),
    questionTypes: questionTypes.length ? questionTypes : ['single_choice'],
    typeCounts: Object.keys(typeCounts).length ? typeCounts : { single_choice: 5 },
    subjects: stringArrayFromDraft(value.subjects),
    requiredTagsStr: typeof value.requiredTagsStr === 'string' ? value.requiredTagsStr : '',
    requiredTags: stringArrayFromDraft(value.requiredTags),
    preferredTagsStr: typeof value.preferredTagsStr === 'string' ? value.preferredTagsStr : '',
    preferredTags: stringArrayFromDraft(value.preferredTags),
    customTagInput: typeof value.customTagInput === 'string' ? value.customTagInput : ''
  }
}

function questionImagesFromDraft (value: unknown): QuestionImage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map(image => ({
      url: typeof image.url === 'string' ? image.url : '',
      ...(typeof image.caption === 'string' ? { caption: image.caption } : {})
    }))
    .filter(image => image.url)
}
