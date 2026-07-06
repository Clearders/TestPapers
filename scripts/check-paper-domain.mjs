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
  ['app/domain/questions/form.ts', 'questions/form.mjs'],
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
    .replace(/(from\s+['"]\.\/(?:constants|form|guards|import|normalization))(['"])/g, '$1.mjs$2')

  const destination = join(tempRoot, outputPath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, output)
}

rmSync(tempRoot, { recursive: true, force: true })
for (const [sourcePath, outputPath] of modules) compileModule(sourcePath, outputPath)

const {
  buildQuestionCreatePayload,
  buildQuestionPatch,
  buildTemporaryQuestionEdit,
  createDefaultQuestionFormState,
  createQuestionEditFormState,
  createTemporaryQuestionEditFormState,
  prepareQuestionEditFormForType,
  prepareQuestionFormForType,
  pruneInvalidQuestionEditFormAnswers
} = await import(pathToFileURL(join(tempRoot, 'questions/index.mjs')))

const {
  buildExamDraftSummary,
  buildExportReadinessItems,
  buildPaperDraftDownloadPayload,
  buildPaperGeneratePayload,
  buildPaperPayload,
  createDefaultGenerationForm,
  createDefaultPaper,
  filenameFromDisposition,
  hasExportReadinessBlockers,
  hasTemporaryQuestionEdits,
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

const questionForm = createDefaultQuestionFormState()
Object.assign(questionForm, {
  subjects: ['  Math  '],
  tags: [' algebra '],
  text: '  Choose $x$.  ',
  options: [' x ', ' y ', '', ''],
  answer: ' y ',
  source: '  Chapter 1 ',
  scoreWeight: '2.5'
})
assert.deepEqual(
  buildQuestionCreatePayload(questionForm),
  {
    type: 'single_choice',
    subjects: ['Math'],
    difficulty: 'medium',
    tags: ['algebra'],
    text: 'Choose $x$.',
    options: ['x', 'y'],
    answer: 'y',
    source: 'Chapter 1',
    scoreWeight: 2.5,
    essayBlankSpace: undefined,
    images: []
  },
  'question create payloads should trim lists, text, answers, source, and options'
)

questionForm.type = 'true_false'
questionForm.options = []
prepareQuestionFormForType(questionForm)
assert.deepEqual(questionForm.options, ['True', 'False'], 'true/false create forms should reset to canonical options')

const multipleChoiceQuestion = {
  ...sampleQuestion,
  type: 'multiple_choice',
  options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
  answer: ['Alpha', 'Gamma']
}
const multipleChoiceEditForm = createQuestionEditFormState(multipleChoiceQuestion)
assert.deepEqual(
  multipleChoiceEditForm.answerMultiple,
  [0, 2],
  'multiple-choice edit forms should hydrate selected answer indexes from answer arrays'
)
multipleChoiceEditForm.options[2] = ' Gamma updated '
assert.deepEqual(
  buildQuestionPatch(multipleChoiceEditForm).answer,
  ['Alpha', 'Gamma updated'],
  'multiple-choice edit patches should send an answer array of selected option text'
)
multipleChoiceEditForm.options[0] = ''
pruneInvalidQuestionEditFormAnswers(multipleChoiceEditForm)
assert.deepEqual(
  multipleChoiceEditForm.answerMultiple,
  [2],
  'multiple-choice edit forms should drop selected answers whose option text was cleared'
)

const legacyMultipleChoiceEditForm = createQuestionEditFormState({
  ...multipleChoiceQuestion,
  answer: 'Alpha, Delta'
})
assert.deepEqual(
  legacyMultipleChoiceEditForm.answerMultiple,
  [0, 3],
  'multiple-choice edit forms should tolerate legacy comma-delimited answer strings'
)

const convertedChoiceEditForm = createQuestionEditFormState(sampleQuestion)
convertedChoiceEditForm.type = 'multiple_choice'
prepareQuestionEditFormForType(convertedChoiceEditForm)
assert.deepEqual(
  convertedChoiceEditForm.answerMultiple,
  [1],
  'changing a single-choice edit form to multiple-choice should preserve the selected answer'
)

const trueFalseEditForm = createQuestionEditFormState({
  ...sampleQuestion,
  type: 'true_false',
  options: undefined,
  answer: 'True'
})
assert.deepEqual(
  trueFalseEditForm.options,
  ['True', 'False'],
  'true/false edit forms should not depend on blank hidden choice options'
)

const editQuestionModal = readFileSync(join(root, 'app/components/questions/EditQuestionModal.vue'), 'utf8')
assert.ok(
  editQuestionModal.includes("v-else-if=\"form.type === 'multiple_choice'\"") &&
    editQuestionModal.includes('v-model="form.answerMultiple"'),
  'edit modal should render a checkbox answer UI for multiple-choice questions'
)
assert.ok(
  editQuestionModal.includes("form.type === 'multiple_choice' && !form.answerMultiple.some(index => form.options[index]?.trim())"),
  'edit modal should validate that multiple-choice edits keep at least one non-empty selected answer'
)

const temporaryEditForm = createTemporaryQuestionEditFormState(sampleQuestion)
Object.assign(temporaryEditForm, {
  type: 'multiple_choice',
  subjectsText: 'Math, Algebra',
  tagsText: 'Proof, Review',
  options: ['A', 'B', ''],
  answerText: 'A, B',
  text: 'Pick both values: $x$',
  marks: '3.2'
})
const editedQuestion = buildTemporaryQuestionEdit(sampleQuestion, temporaryEditForm)
assert.deepEqual(editedQuestion.subjects, ['Math', 'Algebra'], 'draft edits should parse subject lists')
assert.deepEqual(editedQuestion.tags, ['proof', 'review'], 'draft edits should normalize tag lists')
assert.deepEqual(editedQuestion.options, ['A', 'B'], 'draft edits should trim option lists')
assert.deepEqual(editedQuestion.answer, ['A', 'B'], 'draft edits should parse multiple-choice answers')
assert.equal(editedQuestion.marks, 3, 'draft edits should normalize marks')
assert.equal(editedQuestion.hasLatex, true, 'draft edits should detect LaTeX in changed fields')

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

assert.equal(hasTemporaryQuestionEdits(paper), false, 'plain paper questions should not use draft-only DOCX export')

const temporaryPaper = {
  ...paper,
  questions: [{
    ...sampleQuestion,
    text: 'Draft-only 2 + 2 = 4',
    isTemporaryEdit: true,
    originalQuestion: sampleQuestion
  }]
}
const draftDownloadPayload = buildPaperDraftDownloadPayload(temporaryPaper, 'categorized', 'dense', true)
assert.equal(hasTemporaryQuestionEdits(temporaryPaper), true, 'temporary edits should select draft-only DOCX export')
assert.equal(draftDownloadPayload.questionOrder, 'categorized', 'draft DOCX payload should preserve export order')
assert.equal(draftDownloadPayload.layoutDensity, 'dense', 'draft DOCX payload should preserve layout density')
assert.equal(draftDownloadPayload.includeAnswer, true, 'draft DOCX payload should preserve answer export flag')
assert.equal(draftDownloadPayload.questions[0].questionPublicId, 'question-42', 'draft DOCX payload should retain the source question id')
assert.equal(draftDownloadPayload.questions[0].text, 'Draft-only 2 + 2 = 4', 'draft DOCX payload should include temporary question text')
assert.equal(draftDownloadPayload.questions[0].marks, 3, 'draft DOCX payload should normalize question marks')

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

const blockedReadiness = buildExportReadinessItems({
  paper: { ...createDefaultPaper(), title: '', subject: '', questions: [] },
  canReadAnswers: false,
  includeAnswersInExport: false,
  activeCloudDraftName: 'Review copy',
  cloudDraftConflict: true,
  hasCloudDraftChanges: true,
  openCommentCount: 2,
  downloadedLayoutDensity: null,
  layoutDensity: 'auto'
})
assert.equal(hasExportReadinessBlockers(blockedReadiness), true, 'readiness should report blockers for incomplete stale exports')
assert.deepEqual(
  blockedReadiness.filter(item => item.level === 'blocked').map(item => item.id),
  ['missing-title', 'missing-subject', 'missing-questions', 'stale-cloud-draft'],
  'readiness blockers should cover missing fields and stale cloud revisions'
)
assert.ok(
  blockedReadiness.some(item => item.id === 'open-comments' && item.level === 'warning'),
  'open review comments should be warnings'
)
assert.ok(
  blockedReadiness.some(item => item.id === 'answers-omitted' && item.level === 'warning'),
  'missing answer permission should be visible before export'
)

const readyReadiness = buildExportReadinessItems({
  paper,
  canReadAnswers: true,
  includeAnswersInExport: true,
  cloudDraftConflict: false,
  hasCloudDraftChanges: false,
  openCommentCount: 0,
  downloadedLayoutDensity: 'dense',
  layoutDensity: 'auto'
})
assert.equal(hasExportReadinessBlockers(readyReadiness), false, 'complete export readiness should not block')
assert.ok(
  readyReadiness.some(item => item.id === 'effective-layout' && item.level === 'ok'),
  'last downloaded layout should be reported as an OK readiness item'
)

console.log('[paper-domain] OK')
