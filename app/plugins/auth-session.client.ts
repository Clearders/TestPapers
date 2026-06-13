export default defineNuxtPlugin(async () => {
  const auth = useAuth()
  const realtime = useRealtime()
  const questionBank = useQuestionBank()

  const reloadQuestionBank = () => {
    if (!auth.hasPermission('questions:read')) return
    void questionBank.loadQuestions().catch(() => {})
    void questionBank.loadMyQuestions().catch(() => {})
  }

  realtime.on('question.created', (payload: any) => {
    if (!auth.hasPermission('questions:read')) return
    if (payload?.question) questionBank.addQuestionLocally(payload.question)
  })
  realtime.on('question.updated', (payload: any) => {
    if (!auth.hasPermission('questions:read')) return
    if (payload?.question) questionBank.replaceQuestionLocally(payload.question)
  })
  realtime.on('question.deleted', (payload: any) => {
    if (!auth.hasPermission('questions:read')) return
    if (payload?.questionId !== undefined) questionBank.removeQuestionLocally(payload.questionId)
    else reloadQuestionBank()
  })

  await auth.loadSession({ force: true })
  auth.scheduleRefresh()

  if (auth.isAuthenticated.value) {
    realtime.connect()
  }

  watch(auth.isAuthenticated, (authenticated) => {
    if (authenticated) realtime.connect()
    else realtime.disconnect()
  })
})
