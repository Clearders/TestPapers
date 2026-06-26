import type { QuestionDifficulty, QuestionFormInput, QuestionType } from '~/types/question'
import { DEFAULT_ESSAY_BLANK_SPACE, DIFFICULTY_OPTIONS, QUESTION_TYPE_ORDER } from './constants'
import { isOptionQuestionType } from './guards'
import { clampScoreWeight, normalizeEssayBlankSpace } from './normalization'

export interface QuestionImportRow {
  rowNumber: number
  input: QuestionFormInput | null
  errors: string[]
}

export interface QuestionImportResult {
  rows: QuestionImportRow[]
  fatalError: string
}

type ImportRecord = Record<string, unknown>

const DIFFICULTY_SET = new Set<QuestionDifficulty>(DIFFICULTY_OPTIONS.map(option => option.value))
const TYPE_SET = new Set<QuestionType>(QUESTION_TYPE_ORDER)
const OPTION_TYPES = new Set<QuestionType>(['single_choice', 'multiple_choice', 'true_false'])

export const QUESTION_IMPORT_TEMPLATE = [
  'type,subjects,difficulty,tags,text,options,answer,source,scoreWeight',
  'single_choice,Mathematics,medium,algebra;linear,"What is 2 + 2?","3;4;5;6",4,Sample,1',
  'short_answer,Mathematics,easy,latex,"Solve $x+1=2$.",,x=1,Sample,1'
].join('\n')

export function parseQuestionImportText (text: string, filename = ''): QuestionImportResult {
  const trimmed = text.trim()
  if (!trimmed) return { rows: [], fatalError: 'The selected file is empty.' }

  try {
    if (filename.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return parseJsonImport(trimmed)
    }
    return parseCsvImport(trimmed)
  } catch (error) {
    return {
      rows: [],
      fatalError: error instanceof Error ? error.message : 'Failed to parse import file.'
    }
  }
}

function parseJsonImport (text: string): QuestionImportResult {
  const payload = JSON.parse(text)
  const rows = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.questions) ? payload.questions : null
  if (!rows) {
    return { rows: [], fatalError: 'JSON import must be an array or an object with a questions array.' }
  }
  return {
    fatalError: '',
    rows: rows.map((row, index) => normalizeImportRecord(isRecord(row) ? row : {}, index + 1))
  }
}

function parseCsvImport (text: string): QuestionImportResult {
  const records = parseCsv(text)
  if (records.length < 2) return { rows: [], fatalError: 'CSV import requires a header row and at least one question row.' }

  const headers = records[0]?.map(header => normalizeHeader(header)) || []
  if (!headers.includes('text') || !headers.includes('type')) {
    return { rows: [], fatalError: 'CSV import requires at least type and text columns.' }
  }

  return {
    fatalError: '',
    rows: records.slice(1)
      .filter(record => record.some(cell => cell.trim()))
      .map((record, index) => {
        const row: ImportRecord = {}
        headers.forEach((header, headerIndex) => {
          row[header] = record[headerIndex] || ''
        })
        return normalizeImportRecord(row, index + 2)
      })
  }
}

function normalizeImportRecord (record: ImportRecord, rowNumber: number): QuestionImportRow {
  const errors: string[] = []
  const type = parseType(record.type, errors)
  const difficulty = parseDifficulty(record.difficulty, errors)
  const subjects = parseStringList(record.subjects ?? record.subject)
  const tags = parseStringList(record.tags).map(tag => tag.toLowerCase())
  const text = stringValue(record.text).trim()
  const answerValue = record.answer

  if (!subjects.length) errors.push('subjects is required')
  if (!text) errors.push('text is required')

  if (!type || !difficulty) {
    return { rowNumber, input: null, errors }
  }

  let options = parseStringList(record.options)
  if (type === 'true_false' && !options.length) options = ['True', 'False']
  if (OPTION_TYPES.has(type) && !options.length) errors.push('options is required for choice and true/false questions')

  const answer = type === 'multiple_choice'
    ? parseStringList(answerValue)
    : Array.isArray(answerValue)
      ? answerValue.map(item => String(item).trim()).filter(Boolean).join(', ')
      : stringValue(answerValue).trim()
  if (Array.isArray(answer) ? !answer.length : !answer) errors.push('answer is required')

  const input: QuestionFormInput = {
    type,
    subjects,
    difficulty,
    tags: uniqueStrings(tags),
    text,
    ...(isOptionQuestionType(type) ? { options } : {}),
    answer,
    source: stringValue(record.source).trim() || undefined,
    scoreWeight: clampScoreWeight(record.scoreWeight ?? record.weight ?? 1),
    hasLatex: parseOptionalBoolean(record.hasLatex ?? record.latex),
    essayBlankSpace: type === 'essay'
      ? normalizeEssayBlankSpace({
          lines: numberValue(record.essayLines ?? record.lines, DEFAULT_ESSAY_BLANK_SPACE.lines),
          lineHeight: numberValue(record.essayLineHeight ?? record.lineHeight, DEFAULT_ESSAY_BLANK_SPACE.lineHeight)
        })
      : undefined,
    images: []
  }

  return { rowNumber, input: errors.length ? null : input, errors }
}

function parseType (value: unknown, errors: string[]) {
  const type = stringValue(value).trim() as QuestionType
  if (TYPE_SET.has(type)) return type
  errors.push(`type must be one of ${QUESTION_TYPE_ORDER.join(', ')}`)
  return null
}

function parseDifficulty (value: unknown, errors: string[]) {
  const difficulty = stringValue(value).trim() as QuestionDifficulty
  if (DIFFICULTY_SET.has(difficulty)) return difficulty
  errors.push('difficulty must be easy, medium, or hard')
  return null
}

function parseOptionalBoolean (value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = stringValue(value).trim().toLowerCase()
  if (!normalized) return undefined
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return undefined
}

function parseStringList (value: unknown) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map(item => String(item).trim()).filter(Boolean))
  }
  const raw = stringValue(value).trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return uniqueStrings(parsed.map(item => String(item).trim()).filter(Boolean))
    } catch {
      // Fall through to delimiter parsing.
    }
  }
  return uniqueStrings(raw.split(/[;,|]/).map(item => item.trim()).filter(Boolean))
}

function uniqueStrings (items: string[]) {
  return [...new Set(items)]
}

function stringValue (value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function numberValue (value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeHeader (header: string) {
  return header.trim().replace(/[-_\s]+([a-zA-Z])/g, (_, char: string) => char.toUpperCase())
}

function parseCsv (text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)
  return rows
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
