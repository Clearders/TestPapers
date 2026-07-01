<template>
  <div class="site-wrapper">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <div class="dynamic-bg" aria-hidden="true">
      <div class="bg-chroma"/>
      <div class="bg-grid"/>
      <div class="bg-depth bg-depth--one"/>
      <div class="bg-depth bg-depth--two"/>
      <div class="bg-ribbon bg-ribbon--one"/>
      <div class="bg-ribbon bg-ribbon--two"/>
      <div class="bg-ribbon bg-ribbon--three"/>
    </div>

    <header class="site-header">
      <div class="header-inner">
        <NuxtLink to="/" class="logo" aria-label="TestPapers home">
          <span class="logo-mark"><AppIcon name="sparkles" /></span>
          <span>TestPapers</span>
        </NuxtLink>
        <button
          class="nav-toggle"
          type="button"
          :aria-expanded="isNavOpen"
          aria-controls="site-navigation"
          aria-label="Toggle navigation"
          @click="toggleNav"
        >
          <span/>
          <span/>
          <span/>
        </button>
        <nav id="site-navigation" class="site-nav" :class="{ 'is-open': isNavOpen }" @click="closeNav">
          <NuxtLink to="/" class="nav-link">
            <AppIcon name="home" />
            <span>Home</span>
          </NuxtLink>
          <NuxtLink to="/questions" class="nav-link">
            <AppIcon name="book" />
            <span>Workspace</span>
          </NuxtLink>
          <NuxtLink to="/latex" class="nav-link">
            <AppIcon name="latex" />
            <span>LaTeX Preview</span>
          </NuxtLink>
          <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="nav-link nav-link--highlight">
            <AppIcon name="add" />
            <span>Add Problem</span>
          </NuxtLink>
          <NuxtLink v-if="hasPermission('users:manage')" to="/users" class="nav-link">
            <AppIcon name="users" />
            <span>Users</span>
          </NuxtLink>
          <button class="theme-toggle" type="button" :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'" @click.stop="toggleTheme">
            <AppIcon :name="isDark ? 'sun' : 'moon'" />
            <span>{{ isDark ? 'Light' : 'Dark' }}</span>
          </button>
          <UserDropdown v-if="isAuthenticated" />
          <template v-else>
            <NuxtLink to="/register" class="nav-link">
              <AppIcon name="account" />
              <span>Register</span>
            </NuxtLink>
            <NuxtLink
              to="/login"
              class="nav-link nav-link--highlight nav-link--magnetic"
              @pointermove="onMagneticPointerMove"
              @pointerleave="onMagneticPointerLeave"
            >
              <AppIcon name="login" />
              <span>Login</span>
            </NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <div v-if="showRealtimeBanner" class="status-banner status-banner--warning realtime-banner" role="status" aria-live="polite">
      <AppIcon name="settings" />
      <span>{{ realtimeError }}</span>
    </div>

    <main id="main-content" class="site-main">
      <NuxtErrorBoundary>
        <slot />
        <template #error="{ error, clearError }">
          <div class="error-fallback card">
            <span class="state-icon"><AppIcon name="sparkles" /></span>
            <h2>Something went wrong</h2>
            <p>{{ error?.message || 'An unexpected error occurred.' }}</p>
            <button class="btn btn-primary" @click="clearError">
              <AppIcon name="arrow-right" />
              Retry
            </button>
          </div>
        </template>
      </NuxtErrorBoundary>
    </main>

    <footer class="site-footer">
      <p>© {{ currentYear }} TestPapers | Create, manage, and export test papers with ease.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import UserDropdown from '~/components/UserDropdown.vue'

const { hasPermission, isAuthenticated } = useAuth()
const { lastError: realtimeError } = useRealtime()
const { isDark, toggleTheme } = useTheme()
const route = useRoute()
const isNavOpen = ref(false)
const currentYear = new Date().getFullYear()
const showRealtimeBanner = computed(() => isAuthenticated.value && Boolean(realtimeError.value))

const requestURL = useRequestURL()
const canonicalUrl = computed(() => requestURL.origin + route.path)
useSeoMeta({
  ogSiteName: 'TestPapers',
  ogLocale: 'en_US',
  twitterCard: 'summary_large_image',
  ogUrl: canonicalUrl
})
useHead({
  link: [
    { rel: 'canonical', href: canonicalUrl }
  ]
})

function toggleNav () {
  isNavOpen.value = !isNavOpen.value
}

function closeNav () {
  isNavOpen.value = false
}

function onMagneticPointerMove (event: PointerEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target || event.pointerType === 'touch') return

  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left - rect.width / 2
  const y = event.clientY - rect.top - rect.height / 2

  target.style.setProperty('--magnetic-x', `${x * 0.24}px`)
  target.style.setProperty('--magnetic-y', `${y * 0.34}px`)
}

function onMagneticPointerLeave (event: PointerEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return

  target.style.setProperty('--magnetic-x', '0px')
  target.style.setProperty('--magnetic-y', '0px')
}

watch(() => route.fullPath, closeNav)
</script>

<style scoped>
.realtime-banner {
  width: min(var(--site-max-w), calc(100% - var(--site-gutter) - var(--site-gutter)));
  margin: 12px auto 0;
}
</style>
