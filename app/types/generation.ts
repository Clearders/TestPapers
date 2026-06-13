import type { QuestionType } from './question'

export interface GenerationDiagnostics {
  fitness: number
  candidateCount: number
  questionCount: number
  ownQuestionsOnly: boolean
  difficultyActual: Record<string, number>
  difficultyTargets: Record<string, number>
  typeActual: Record<string, number>
  typeTargets: Record<string, number>
  difficultyCoefficient: number
  scoreWeightActual: number
  marksActual: number
  generationsRun: number
  requiredTags: string[]
  preferredTags: string[]
}

export interface GenerationFormState {
  difficultyCoefficient: number
  questionTypes: QuestionType[]
  typeCounts: Record<string, number>
  subjects: string[]
  requiredTagsStr: string
  requiredTags: string[]
  preferredTagsStr: string
  preferredTags: string[]
  customTagInput: string
}

export type ExportMode = 'paper' | 'categorized'
