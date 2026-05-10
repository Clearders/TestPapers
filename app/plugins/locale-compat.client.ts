export default defineNuxtPlugin(() => {
  localStorage.removeItem('app-locale')

  document.cookie = 'i18n_redirected=; Max-Age=0; Path=/; SameSite=Lax'
})
