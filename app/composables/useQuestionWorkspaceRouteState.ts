import type { BankMode } from '~/domain/papers'
import type { QuestionDifficulty, QuestionQueryParams, QuestionType } from '~/types/question'
import { parseBankMode, parseQuestionDifficulty } from '~/domain/papers'
import { QUESTION_TYPE_ORDER } from '~/domain/questions'

export type WorkspaceSection = 'editor' | 'bank'
type LatexFilter = '' | 'true' | 'false'

function queryString (value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseWorkspaceSection (value: unknown): WorkspaceSection {
  return value === 'bank' ? 'bank' : 'editor'
}

function parseQuestionTypeFilter (value: unknown): QuestionType | '' {
  return typeof value === 'string' && QUESTION_TYPE_ORDER.includes(value as QuestionType) ? value as QuestionType : ''
}

function parseLatexFilter (value: unknown): LatexFilter {
  return value === 'true' || value === 'false' ? value : ''
}

export function useQuestionWorkspaceRouteState (defaultPageSize = 20) {
  const route = useRoute()
  const router = useRouter()

  const activeSection = ref<WorkspaceSection>(parseWorkspaceSection(route.query.section))
  const search = ref(queryString(route.query.q))
  const filterSubject = ref(queryString(route.query.subjects))
  const filterDifficulty = ref<QuestionDifficulty | ''>(parseQuestionDifficulty(route.query.difficulty))
  const filterType = ref<QuestionType | ''>(parseQuestionTypeFilter(route.query.type))
  const filterTag = ref(queryString(route.query.tags))
  const filterHasLatex = ref<LatexFilter>(parseLatexFilter(route.query.hasLatex))
  const bankMode = ref<BankMode>(parseBankMode(route.query.bank))
  const pageSize = ref(defaultPageSize)

  function syncQuery () {
    const query: Record<string, string> = {}
    const q = search.value.trim()
    if (activeSection.value !== 'editor') query.section = activeSection.value
    if (q) query.q = q
    if (filterSubject.value) query.subjects = filterSubject.value
    if (filterDifficulty.value) query.difficulty = filterDifficulty.value
    if (filterType.value) query.type = filterType.value
    if (filterTag.value) query.tags = filterTag.value
    if (filterHasLatex.value) query.hasLatex = filterHasLatex.value
    if (bankMode.value !== 'all') query.bank = bankMode.value
    void router.replace({ query })
  }

  function resetFilters () {
    search.value = ''
    filterSubject.value = ''
    filterDifficulty.value = ''
    filterType.value = ''
    filterTag.value = ''
    filterHasLatex.value = ''
  }

  function toQuestionQuery (page: number): QuestionQueryParams {
    return {
      q: search.value.trim() || undefined,
      subjects: filterSubject.value || undefined,
      difficulty: filterDifficulty.value || undefined,
      type: filterType.value || undefined,
      tags: filterTag.value || undefined,
      hasLatex: filterHasLatex.value ? filterHasLatex.value === 'true' : undefined,
      page,
      pageSize: pageSize.value,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }
  }

  return {
    activeSection,
    search,
    filterSubject,
    filterDifficulty,
    filterType,
    filterTag,
    filterHasLatex,
    bankMode,
    pageSize,
    syncQuery,
    resetFilters,
    toQuestionQuery
  }
}
