import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const tempRoot = join(root, '.cache', 'paper-domain-check')

const modules = [
  ['app/domain/questions/constants.ts', 'questions/constants.mjs'],
  ['app/domain/questions/guards.ts', 'questions/guards.mjs'],
  ['app/domain/questions/normalization.ts', 'questions/normalization.mjs'],
  ['app/domain/questions/import.ts', 'questions/import.mjs'],
  ['app/domain/questions/index.ts', 'questions/index.mjs'],
  ['app/domain/papers/index.ts', 'papers/index.mjs']
]

function compileModule (sourcePath, outputPath) {
  const source = readFileSync(join(root, sourcePath), 'utf8')
  let output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText

  output = output
    .replace(/(from\s+['"])~\/domain\/questions(['"])/g, '$1../questions/index.mjs$2')
    .replace(/(from\s+['"]\.\/(?:constants|guards|import|normalization))(['"])/g, '$1.mjs$2')

  const destination = join(tempRoot, outputPath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, output)
}

rmSync(tempRoot, { recursive: true, force: true })
for (const [sourcePath, outputPath] of modules) compileModule(sourcePath, outputPath)

const {
  buildExamDraftSummary,
  buildPaperGeneratePayload,
  buildPaperPayload,
  createDefaultGenerationForm,
  createDefaultPaper,
  filenameFromDisposition,
  validateWorkspaceDraft
} = await import(pathToFileURL(join(tempRoot, 'papers/index.mjs')))

const sampleQuestion = {
  id: 42,
  publicId: 'question-42',
  type: 'single_choice',
  subjects: ['Math'],
  difficulty: 'easy',
  tags: ['algebra'],
  text: '2 + 2 = ?',
  options: ['3', '4'],
  answer: '4',
  hasLatex: false,
  scoreWeight: 1,
  marks: 2.6
}

const paper = {
  ...createDefaultPaper(),
  title: '  Algebra Quiz  ',
  subject: '  Math  ',
  duration: '45.4',
  totalMarks: '99.6',
  questions: [sampleQuestion]
}

assert.deepEqual(
  buildPaperPayload(paper),
  {
    title: 'Algebra Quiz',
    subject: 'Math',
    duration: 45,
    totalMarks: 100,
    questions: [
      {
        questionPublicId: 'question-42',
        orderNo: 1,
        marks: 3
      }
    ]
  },
  'paper payloads should trim metadata, normalize numbers, and preserve ordered question refs'
)

const generationForm = {
  ...createDefaultGenerationForm(),
  difficultyCoefficient: 2,
  questionTypes: ['single_choice', 'essay'],
  typeCounts: { single_choice: 3 },
  subjects: ['Math'],
  requiredTags: ['algebra'],
  preferredTags: ['proof']
}

assert.deepEqual(
  buildPaperGeneratePayload(paper, generationForm, 'mine'),
  {
    title: 'Algebra Quiz',
    subjects: ['Math'],
    duration: 45,
    totalMarks: 100,
    difficultyCoefficient: 1,
    questionTypes: [
      { questionType: 'single_choice', count: 3 },
      { questionType: 'essay', count: 1 }
    ],
    ownQuestionsOnly: true,
    requiredTags: ['algebra'],
    preferredTags: ['proof']
  },
  'generation payloads should clamp difficulty, default missing counts, and preserve filters'
)

assert.equal(
  buildPaperGeneratePayload({ ...paper, title: '   ' }, generationForm, 'all'),
  null,
  'generation payloads should require a paper title'
)
assert.equal(
  buildPaperGeneratePayload(paper, { ...generationForm, subjects: [] }, 'all'),
  null,
  'generation payloads should require at least one subject'
)

const validatedDraft = validateWorkspaceDraft({
  version: 1,
  paper: {
    title: 123,
    subject: 'Science',
    duration: '30.8',
    totalMarks: 'not a number',
    questions: [
      sampleQuestion,
      { id: 0, publicId: '', type: 'unknown' }
    ]
  },
  generationForm: {
    difficultyCoefficient: -1,
    questionTypes: ['essay', 'unknown'],
    typeCounts: { essay: '4.2' },
    subjects: ['Science', 2],
    requiredTags: ['lab', false],
    preferredTags: ['review']
  },
  exportMode: 'categorized',
  layoutDensity: 'dense',
  includeAnswersInExport: 1,
  savedPaperId: 'paper-1',
  savedPaperSignature: 24,
  generationDiagnostics: {}
})

assert.equal(validatedDraft.paper.title, '', 'draft validation should repair invalid titles')
assert.equal(validatedDraft.paper.duration, 31, 'draft validation should normalize duration')
assert.equal(validatedDraft.paper.totalMarks, 100, 'draft validation should default invalid total marks')
assert.equal(validatedDraft.paper.questions.length, 1, 'draft validation should discard invalid question rows')
assert.deepEqual(validatedDraft.generationForm.questionTypes, ['essay'], 'draft validation should keep valid question types')
assert.deepEqual(validatedDraft.generationForm.typeCounts, { essay: 4 }, 'draft validation should normalize type counts')
assert.deepEqual(validatedDraft.generationForm.subjects, ['Science'], 'draft validation should filter subject arrays')
assert.deepEqual(validatedDraft.generationForm.requiredTags, ['lab'], 'draft validation should filter required tags')
assert.equal(validatedDraft.layoutDensity, 'dense', 'draft validation should preserve valid layout density')
assert.equal(validatedDraft.includeAnswersInExport, true, 'draft validation should normalize answer-export flags')

const summary = buildExamDraftSummary('draft-1', '   ', validatedDraft, '2026-06-14T00:00:00.000Z')
assert.equal(summary.name, 'Untitled draft', 'draft summaries should fall back when name and title are empty')

assert.equal(
  filenameFromDisposition("attachment; filename*=UTF-8''Algebra%20Quiz.docx", 'Fallback'),
  'Algebra Quiz.docx',
  'download filenames should decode RFC 5987 filenames'
)

console.log('[paper-domain] OK')
