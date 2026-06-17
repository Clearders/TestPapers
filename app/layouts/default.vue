<template>
  <div class="site-wrapper">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <div class="dynamic-bg" aria-hidden="true">
      <div class="bg-grid"></div>
      <div class="bg-ribbon bg-ribbon--one"></div>
      <div class="bg-ribbon bg-ribbon--two"></div>
      <div class="bg-ribbon bg-ribbon--three"></div>
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
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav id="site-navigation" class="site-nav" :class="{ 'is-open': isNavOpen }" @click="closeNav">
          <NuxtLink to="/" class="nav-link">
            <AppIcon name="home" />
            <span>Home</span>
          </NuxtLink>
          <NuxtLink v-if="isAuthenticated" to="/questions" class="nav-link">
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
            <NuxtLink to="/login" class="nav-link nav-link--highlight">
              <AppIcon name="login" />
              <span>Login</span>
            </NuxtLink>
          </template>
        </nav>
      </div>
    </header>

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
const { isDark, toggleTheme } = useTheme()
const route = useRoute()
const isNavOpen = ref(false)
const currentYear = new Date().getFullYear()

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

watch(() => route.fullPath, closeNav)
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --color-bg: #fbf8ff;
  --color-bg-strong: #f3edff;
  --color-surface: rgba(255, 255, 255, 0.86);
  --color-surface-solid: #ffffff;
  --color-surface-raised: rgba(255, 255, 255, 0.94);
  --color-primary: #7657ff;
  --color-primary-d: #5a3ee8;
  --color-secondary: #0ea5e9;
  --color-accent: #00b894;
  --color-warm: #ff8a4c;
  --color-text: #171326;
  --color-muted: #716a80;
  --color-border: rgba(116, 91, 255, 0.18);
  --color-danger: #ef4444;
  --radius: 8px;
  --shadow: 0 18px 45px rgba(62, 40, 126, 0.13);
  --shadow-soft: 0 8px 24px rgba(62, 40, 126, 0.1);
  --ring: 0 0 0 3px rgba(118, 87, 255, 0.18);
  --header-h: 66px;
  --site-max-w: 1220px;
  --site-gutter: clamp(14px, 3vw, 34px);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
}

[data-theme="dark"] {
  --color-bg: #11101a;
  --color-bg-strong: #18152a;
  --color-surface: rgba(30, 27, 48, 0.82);
  --color-surface-solid: #211d35;
  --color-surface-raised: rgba(36, 31, 58, 0.94);
  --color-primary: #a78bfa;
  --color-primary-d: #8b5cf6;
  --color-secondary: #38bdf8;
  --color-accent: #5eead4;
  --color-warm: #fb923c;
  --color-text: #f7f3ff;
  --color-muted: #b7adc9;
  --color-border: rgba(196, 181, 253, 0.18);
  --color-danger: #f87171;
  --shadow: 0 20px 48px rgba(0, 0, 0, 0.36);
  --shadow-soft: 0 10px 26px rgba(0, 0, 0, 0.28);
  --ring: 0 0 0 3px rgba(167, 139, 250, 0.22);
  color-scheme: dark;
}

a { color: inherit; text-decoration: none; }
button { cursor: pointer; font: inherit; touch-action: manipulation; }
input, textarea, select {
  font: inherit;
  max-width: 100%;
}
select { background-color: var(--color-surface-solid); color: var(--color-text); }
img, svg, canvas, video { max-width: 100%; }
a, button, [role="button"] { -webkit-tap-highlight-color: transparent; }

.skip-link {
  position: fixed;
  top: -100%;
  left: 12px;
  z-index: 200;
  padding: 10px 16px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 0 0 var(--radius) var(--radius);
  font-weight: 700;
  font-size: .9rem;
}
.skip-link:focus-visible { top: 0; }

.site-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  overflow-x: clip;
}

.dynamic-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  background:
    linear-gradient(115deg, rgba(255, 138, 76, 0.14), transparent 28%),
    linear-gradient(235deg, rgba(14, 165, 233, 0.16), transparent 34%),
    linear-gradient(180deg, var(--color-bg), var(--color-bg-strong));
}
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(118, 87, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(118, 87, 255, 0.08) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, #000, transparent 90%);
}
.bg-ribbon {
  position: absolute;
  width: 82vw;
  height: 190px;
  border: 1px solid rgba(118, 87, 255, 0.14);
  transform: rotate(-10deg);
  opacity: 0.62;
}
.bg-ribbon--one {
  top: 70px;
  left: -20vw;
  background: linear-gradient(90deg, rgba(118, 87, 255, 0.16), rgba(14, 165, 233, 0.08), transparent);
}
.bg-ribbon--two {
  right: -24vw;
  top: 40vh;
  height: 240px;
  transform: rotate(13deg);
  background: linear-gradient(90deg, transparent, rgba(255, 138, 76, 0.13), rgba(0, 184, 148, 0.1));
}
.bg-ribbon--three {
  left: 4vw;
  bottom: -90px;
  height: 160px;
  transform: rotate(4deg);
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.1), rgba(118, 87, 255, 0.12));
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes navIn {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: translateY(0); }
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  min-height: var(--header-h);
  background: color-mix(in srgb, var(--color-surface-raised) 88%, transparent);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(62, 40, 126, 0.08);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  animation: navIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.header-inner {
  max-width: var(--site-max-w);
  margin: 0 auto;
  padding: 0 var(--site-gutter);
  min-height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  position: relative;
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1.12rem;
  font-weight: 850;
  letter-spacing: 0;
  color: var(--color-text);
  white-space: nowrap;
}
.logo-mark,
.state-icon {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 10px 24px rgba(118, 87, 255, 0.3);
}
.site-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-toggle {
  display: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-solid);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: var(--color-text);
  box-shadow: var(--shadow-soft);
}
.nav-toggle span {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}
.nav-link,
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: .88rem;
  font-weight: 700;
  color: var(--color-muted);
  transition: background 0.22s ease, color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
}
.nav-link:hover,
.theme-toggle:hover {
  background: rgba(118, 87, 255, 0.08);
  color: var(--color-text);
  transform: translateY(-1px);
}
.nav-link.router-link-active {
  background: rgba(118, 87, 255, 0.12);
  color: var(--color-primary);
}
.nav-link--highlight {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #fff !important;
  box-shadow: 0 10px 24px rgba(118, 87, 255, 0.24);
}
.nav-link--highlight:hover {
  background: linear-gradient(135deg, var(--color-primary-d), var(--color-secondary));
  box-shadow: 0 14px 30px rgba(118, 87, 255, 0.32);
}
.nav-button {
  border: 0;
  background: transparent;
}
.theme-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  white-space: nowrap;
}

.site-main {
  flex: 1;
  max-width: var(--site-max-w);
  width: 100%;
  margin: 0 auto;
  padding: clamp(22px, 4vw, 40px) var(--site-gutter);
  animation: pageIn 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.site-footer {
  text-align: center;
  padding: 22px;
  font-size: .82rem;
  color: var(--color-muted);
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  padding: 20px;
  min-width: 0;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: rgba(118, 87, 255, 0.28);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 17px;
  border-radius: var(--radius);
  font-size: .9rem;
  font-weight: 750;
  border: 1px solid transparent;
  transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #fff;
  box-shadow: 0 10px 24px rgba(118, 87, 255, 0.22);
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary-d), var(--color-secondary));
  box-shadow: 0 14px 30px rgba(118, 87, 255, 0.3);
  transform: translateY(-1px);
}
.btn-outline {
  background: color-mix(in srgb, var(--color-surface-solid) 78%, transparent);
  color: var(--color-primary);
  border-color: var(--color-border);
}
.btn-outline:hover:not(:disabled) {
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary-d);
  border-color: rgba(118, 87, 255, 0.32);
  transform: translateY(-1px);
}
.btn-danger { background: var(--color-danger); color: #fff; }
.btn-danger:hover:not(:disabled) { background: #dc2626; transform: translateY(-1px); }
.btn-success { background: linear-gradient(135deg, var(--color-accent), #22c55e); color: #062118; }
.btn-success:hover:not(:disabled) { box-shadow: 0 12px 26px rgba(0, 184, 148, 0.26); transform: translateY(-1px); }
.btn-sm { min-height: 32px; padding: 5px 12px; font-size: .8rem; }

.badge,
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  font-weight: 750;
}
.badge {
  padding: 3px 10px;
  font-size: .75rem;
}
.badge-easy { background: rgba(0, 184, 148, 0.13); color: #087f62; }
.badge-medium { background: rgba(255, 138, 76, 0.15); color: #a94e17; }
.badge-hard { background: rgba(239, 68, 68, 0.14); color: #b91c1c; }
.tag {
  padding: 3px 9px;
  font-size: .75rem;
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
}

.page-title {
  font-size: clamp(1.65rem, 4vw, 2.45rem);
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: 0;
  margin-bottom: 8px;
}
.page-sub {
  color: var(--color-muted);
  margin-bottom: 24px;
  font-size: .98rem;
  line-height: 1.6;
  max-width: 760px;
}
.form-group { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.form-label { font-size: .86rem; font-weight: 800; color: var(--color-text); }
.form-input {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-surface-solid) 88%, transparent);
  color: var(--color-text);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, transform 0.22s ease;
}
.form-input:focus-visible,
.btn:focus-visible,
.nav-link:focus-visible,
.theme-toggle:focus-visible,
.nav-toggle:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--ring);
}
.form-input:focus-visible {
  background: var(--color-surface-solid);
  transform: translateY(-1px);
}
.form-hint { font-size: .78rem; color: var(--color-muted); line-height: 1.45; }

.list-enter-active, .list-leave-active { transition: opacity 0.28s ease, transform 0.28s ease; }
.list-enter-from { opacity: 0; transform: translateY(12px); }
.list-leave-to { opacity: 0; transform: translateY(-8px); }
.list-leave-active { position: absolute; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-8px); }

.error-fallback {
  max-width: 520px;
  margin: 48px auto;
  padding: 32px;
  text-align: center;
}
.error-fallback .state-icon {
  margin: 0 auto 14px;
}
.error-fallback h2 {
  font-size: 1.25rem;
  margin-bottom: 12px;
}
.error-fallback p {
  color: var(--color-muted);
  margin-bottom: 20px;
}

@media (min-width: 1440px) {
  :root { --site-max-w: 1340px; }
}

@media (max-width: 980px) {
  :root { --header-h: 60px; }

  .nav-toggle { display: inline-flex; }

  .site-nav {
    position: absolute;
    top: calc(100% + 10px);
    right: var(--site-gutter);
    left: var(--site-gutter);
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 7px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow);
    backdrop-filter: blur(22px);
  }

  .site-nav.is-open { display: flex; }

  .nav-link,
  .theme-toggle {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .site-main { padding-top: 20px; }
  .card { padding: 16px; }
  .page-sub { margin-bottom: 18px; }
  .btn { width: auto; }
}

@media (hover: none) {
  .card:hover,
  .btn:hover,
  .nav-link:hover,
  .theme-toggle:hover {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

[data-theme="dark"] .badge-easy { background: rgba(94, 234, 212, 0.15); color: #5eead4; }
[data-theme="dark"] .badge-medium { background: rgba(251, 146, 60, 0.16); color: #fdba74; }
[data-theme="dark"] .badge-hard { background: rgba(248, 113, 113, 0.16); color: #fca5a5; }
[data-theme="dark"] .tag { background: rgba(167, 139, 250, 0.14); color: var(--color-primary); }
[data-theme="dark"] .form-input { background: rgba(17, 16, 26, 0.56); }
[data-theme="dark"] .dynamic-bg {
  background:
    linear-gradient(115deg, rgba(251, 146, 60, 0.12), transparent 30%),
    linear-gradient(235deg, rgba(56, 189, 248, 0.12), transparent 34%),
    linear-gradient(180deg, var(--color-bg), var(--color-bg-strong));
}
</style>
