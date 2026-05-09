/**
 * Client-side plugin that restores the user's locale preference from localStorage
 * and keeps localStorage in sync with the current locale.
 *
 * This works alongside @nuxtjs/i18n's cookie-based persistence to ensure the
 * language choice survives cookie clears and browser restarts.
 */
export default defineNuxtPlugin(() => {
  const nuxtLocale = useLocale()

  // Restore saved locale on app initialization
  const savedLocale = localStorage.getItem('app-locale')
  if (
    savedLocale &&
    ['en', 'zh'].includes(savedLocale) &&
    savedLocale !== nuxtLocale.value
  ) {
    nuxtLocale.value = savedLocale
  }

  // Persist every locale change to localStorage
  watch(nuxtLocale, (newLocale) => {
    localStorage.setItem('app-locale', newLocale)
  })
})
