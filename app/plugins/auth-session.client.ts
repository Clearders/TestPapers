export default defineNuxtPlugin(() => {
  const { loadSession } = useAuth()
  void loadSession()
})
