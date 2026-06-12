<template>
  <div class="site-wrapper">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <div class="dynamic-bg" aria-hidden="true">
      <div class="bg-pattern"></div>
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
      <div class="shape shape-5"></div>
    </div>

    <header class="site-header">
      <div class="header-inner">
        <NuxtLink to="/" class="logo">TestPapers</NuxtLink>
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
          <NuxtLink to="/" class="nav-link">Home</NuxtLink>
          <NuxtLink v-if="isAuthenticated" to="/questions" class="nav-link">Workspace</NuxtLink>
          <NuxtLink to="/latex" class="nav-link">LaTeX Preview</NuxtLink>
          <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="nav-link nav-link--highlight">+ Add Problem</NuxtLink>
          <NuxtLink v-if="hasPermission('users:manage')" to="/users" class="nav-link">Users</NuxtLink>
          <button class="theme-toggle" type="button" @click.stop="toggleTheme">
            {{ isDark ? '☀ Light' : '☾ Dark' }}
          </button>
          <UserDropdown v-if="isAuthenticated" />
          <template v-else>
            <NuxtLink to="/register" class="nav-link">Register</NuxtLink>
            <NuxtLink to="/login" class="nav-link nav-link--highlight">Login</NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <main id="main-content" class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <p>© {{ currentYear }} TestPapers | Create, manage and export test papers with ease.</p>
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
  --color-bg: #f5f7fb;
  --color-surface: #ffffff;
  --color-primary: #4f6ef7;
  --color-primary-d: #3a56d4;
  --color-accent: #22c55e;
  --color-text: #1e2a3a;
  --color-muted: #6b7280;
  --color-border: #e2e8f0;
  --color-danger: #ef4444;
  --radius: 8px;
  --shadow: 0 2px 12px rgba(0,0,0,.08);
  --header-h: 60px;
  --site-max-w: 1180px;
  --site-gutter: clamp(14px, 3vw, 32px);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
}

[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-primary: #818cf8;
  --color-primary-d: #6366f1;
  --color-accent: #4ade80;
  --color-text: #e2e8f0;
  --color-muted: #94a3b8;
  --color-border: #334155;
  --color-danger: #f87171;
  --shadow: 0 2px 12px rgba(0,0,0,.4);
  color-scheme: dark;
}

a { color: inherit; text-decoration: none; }
button { cursor: pointer; font: inherit; touch-action: manipulation; }
input, textarea, select { font: inherit; max-width: 100%; }
select { background-color: var(--color-surface); color: var(--color-text); }
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
  font-weight: 600;
  font-size: .9rem;
}
.skip-link:focus {
  top: 0;
}

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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  background: var(--color-bg);
}
.bg-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--color-border) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.6;
  z-index: 1;
}
.shape {
  position: absolute;
  filter: blur(80px);
  opacity: 0.35;
  border-radius: 50%;
  animation: float 20s infinite ease-in-out alternate;
  z-index: 0;
}
.shape-1 {
  width: 300px;
  height: 300px;
  background: var(--color-primary);
  top: -10%;
  left: -10%;
}
.shape-2 {
  width: 400px;
  height: 400px;
  background: #22c55e;
  bottom: -20%;
  right: -10%;
  animation-delay: -5s;
  animation-duration: 25s;
}
.shape-3 {
  width: 250px;
  height: 250px;
  background: #3a56d4;
  top: 40%;
  left: 60%;
  animation-delay: -10s;
  animation-duration: 18s;
}
.shape-4 {
  width: 350px;
  height: 350px;
  background: #f43f5e;
  top: 20%;
  right: 15%;
  animation-delay: -7s;
  animation-duration: 22s;
}
.shape-5 {
  width: 450px;
  height: 450px;
  background: #eab308;
  bottom: 0%;
  left: 20%;
  animation-delay: -14s;
  animation-duration: 30s;
}
@keyframes float {
  0% { transform: translate(0, 0) scale(1) rotate(0deg); }
  33% { transform: translate(15%, 20%) scale(1.15) rotate(45deg); }
  66% { transform: translate(-10%, 15%) scale(0.95) rotate(-30deg); }
  100% { transform: translate(-5%, -10%) scale(0.9) rotate(0deg); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  min-height: var(--header-h);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.header-inner {
  max-width: var(--site-max-w);
  margin: 0 auto;
  padding: 0 var(--site-gutter);
  height: 100%;
  min-height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  position: relative;
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}
.site-nav { display: flex; align-items: center; gap: 4px; }
.nav-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
}
.nav-toggle span {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: var(--color-text);
}
.nav-link {
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: .9rem;
  font-weight: 500;
  color: var(--color-muted);
  transition: color 0.3s ease, background 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.nav-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-primary);
  transition: width 0.3s ease, transform 0.3s ease;
  transform: translateX(-50%);
}
.nav-link:hover { background: var(--color-bg); color: var(--color-text); }
.nav-link:hover::after { width: 60%; }
.nav-link.router-link-active { background: #eff3fe; color: var(--color-primary); }
.nav-link--highlight {
  background: var(--color-primary);
  color: #fff !important;
  margin-left: 8px;
}
.nav-link--highlight::after { display: none; }
.nav-link--highlight:hover {
  background: var(--color-primary-d) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 110, 247, 0.3);
}
.nav-link--highlight.router-link-active { background: var(--color-primary-d) !important; }
.nav-button {
  border: 0;
  background: transparent;
}
.site-main {
  flex: 1;
  max-width: var(--site-max-w);
  width: 100%;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 36px) var(--site-gutter);
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.site-footer {
  text-align: center;
  padding: 20px;
  font-size: .8rem;
  color: var(--color-muted);
  border-top: 1px solid var(--color-border);
  animation: fadeIn 0.8s ease backwards;
  animation-delay: 0.2s;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  min-width: 0;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius);
  font-size: .9rem;
  font-weight: 500;
  border: none;
  transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-d);
  box-shadow: 0 4px 12px rgba(79, 110, 247, 0.25);
}
.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.btn-outline:hover:not(:disabled) { background: #eff3fe; }
.btn-danger { background: var(--color-danger); color: #fff; }
.btn-danger:hover:not(:disabled) { background: #dc2626; }
.btn-success { background: var(--color-accent); color: #fff; }
.btn-success:hover:not(:disabled) { background: #16a34a; }
.btn-sm { padding: 5px 12px; font-size: .8rem; }
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
}
.badge-easy { background: #dcfce7; color: #15803d; }
.badge-medium { background: #fef9c3; color: #a16207; }
.badge-hard { background: #fee2e2; color: #b91c1c; }
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 500;
  background: #eff3fe;
  color: var(--color-primary);
}
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 6px;
  animation: slideDown 0.5s ease backwards;
}
.page-sub {
  color: var(--color-muted);
  margin-bottom: 24px;
  font-size: .95rem;
  animation: slideDown 0.5s ease backwards;
  animation-delay: 0.1s;
}
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.form-label { font-size: .875rem; font-weight: 600; }
.form-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.15);
  transform: translateY(-1px);
}
.form-hint { font-size: .775rem; color: var(--color-muted); }
.list-enter-active, .list-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.list-enter-from { opacity: 0; transform: translateX(20px); }
.list-leave-to { opacity: 0; transform: translateX(-20px); }
.list-leave-active { position: absolute; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-10px); }

@media (min-width: 1440px) {
  :root {
    --site-max-w: 1320px;
  }
}

@media (max-width: 960px) {
  :root {
    --header-h: 56px;
  }

  .nav-toggle {
    display: inline-flex;
  }

  .site-nav {
    position: absolute;
    top: calc(100% + 8px);
    right: var(--site-gutter);
    left: var(--site-gutter);
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  }

  .site-nav.is-open {
    display: flex;
  }

  .nav-link,
  .nav-button {
    width: 100%;
    min-height: 40px;
    text-align: left;
  }

  .nav-link--highlight {
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .shape {
    filter: blur(60px);
    opacity: 0.22;
  }

  .site-main {
    padding-top: 20px;
  }

  .card {
    padding: 16px;
  }

  .page-title {
    font-size: 1.45rem;
  }

  .page-sub {
    margin-bottom: 18px;
  }

  .btn {
    justify-content: center;
  }
}

@media (hover: none) {
  .card:hover,
  .nav-link--highlight:hover {
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

.theme-toggle {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  cursor: pointer;
  font-size: .85rem;
  padding: 6px 12px;
  white-space: nowrap;
}
.theme-toggle:hover {
  background: var(--color-bg);
}

[data-theme="dark"] .dynamic-bg { background: var(--color-bg); }
[data-theme="dark"] .bg-pattern { background-image: radial-gradient(var(--color-border) 1px, transparent 1px); opacity: 0.25; }
[data-theme="dark"] .shape { opacity: 0.18; }
[data-theme="dark"] .site-header { background: var(--color-surface); border-bottom-color: var(--color-border); }
[data-theme="dark"] .nav-link:hover { background: var(--color-bg); }
[data-theme="dark"] .nav-link.router-link-active { background: rgba(129, 140, 248, 0.15); color: var(--color-primary); }
[data-theme="dark"] .site-nav { background: rgba(30, 41, 59, 0.96); }
[data-theme="dark"] .btn-outline:hover:not(:disabled) { background: rgba(129, 140, 248, 0.12); }
[data-theme="dark"] .badge-easy { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
[data-theme="dark"] .badge-medium { background: rgba(250, 204, 21, 0.15); color: #facc15; }
[data-theme="dark"] .badge-hard { background: rgba(248, 113, 113, 0.15); color: #f87171; }
[data-theme="dark"] .tag { background: rgba(129, 140, 248, 0.15); color: var(--color-primary); }
[data-theme="dark"] .form-input { background: var(--color-surface); border-color: var(--color-border); color: var(--color-text); }
[data-theme="dark"] .correction-report-btn:hover { background: rgba(248, 113, 113, 0.08); }
[data-theme="dark"] .revision-diff-table th { background: var(--color-bg); }
[data-theme="dark"] .revision-diff-table td { border-color: var(--color-border); }
[data-theme="dark"] .revision-item:hover { background: var(--color-bg); }
</style>
