type Theme = 'light' | 'dark'

export function useTheme() {
  const theme = useCookie<Theme>('theme', {
    default: () => resolveInitialTheme(),
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax'
  })

  const isDark = computed(() => theme.value === 'dark')

  function resolveInitialTheme(): Theme {
    if (import.meta.server) return 'light'
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  }

  function applyTheme(value: Theme) {
    if (import.meta.server) return
    const root = document.documentElement
    if (value === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
    setThemeMeta(value)
  }

  function setThemeMeta(value: Theme) {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', value === 'dark' ? '#0f172a' : '#f5f7fb')
    }
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  watchEffect(() => applyTheme(theme.value))

  return { theme, isDark, toggleTheme }
}
