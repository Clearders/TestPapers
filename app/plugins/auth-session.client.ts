export default defineNuxtPlugin(async () => {
  const auth = useAuth()
  const realtime = useRealtime()
  const questionBank = useQuestionBank()

  const reloadQuestionBank = () => {
    if (!auth.hasPermission('questions:read')) return
    void questionBank.loadQuestions().catch(() => {})
    void questionBank.loadMyQuestions().catch(() => {})
  }

  realtime.on('question.created', reloadQuestionBank)
  realtime.on('question.updated', reloadQuestionBank)
  realtime.on('question.deleted', reloadQuestionBank)

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
