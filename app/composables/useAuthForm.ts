export function useAuthForm () {
  const username = ref('')
  const password = ref('')
  const isSubmitting = ref(false)

  function reset () {
    username.value = ''
    password.value = ''
    isSubmitting.value = false
  }

  return { username, password, isSubmitting, reset }
}
