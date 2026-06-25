<template>
  <section class="auth-page">
    <div class="auth-card card">
      <div class="auth-mark"><AppIcon name="login" /></div>
      <h1 class="page-title">Login</h1>
      <p class="page-sub">Sign in to access the question bank and protected authoring tools.</p>

      <form class="auth-form" @submit.prevent="submitLogin">
        <div class="form-group">
          <label class="form-label" for="login-username">Username</label>
          <input id="login-username" v-model="username" class="form-input" autocomplete="username" name="username" required >
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Password</label>
          <input id="login-password" v-model="password" class="form-input" type="password" autocomplete="current-password" name="password" required >
        </div>
        <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="auth-spinner"/>
          <AppIcon v-else name="login" />
          {{ isSubmitting ? 'Signing in…' : 'Sign In' }}
        </button>
        <p v-if="errorMessage" class="login-error" role="alert" aria-live="polite">{{ errorMessage }}</p>
      </form>

      <p class="register-prompt">
        Need an account?
        <NuxtLink to="/register">Create one</NuxtLink>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { stripLegacyLocalePrefix } from '~~/shared/legacy-locale'
import { apiErrorMessage } from '~/utils/apiError'

definePageMeta({
  guestOnly: true
})

const { login } = useAuth()
const route = useRoute()
const { username, password, isSubmitting } = useAuthForm()

const errorMessage = ref('')

useSeoMeta({
  title: 'Login',
  description: 'Sign in to TestPapers to access your question bank, create and manage test papers with live LaTeX support.'
})

const redirectTarget = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/questions'
  const normalized = stripLegacyLocalePrefix(redirect)

  if (!normalized.startsWith('/') || normalized.startsWith('//')) return '/questions'

  return normalized
})

watchEffect(() => {
  const currentRedirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''

  if (!currentRedirect || currentRedirect === redirectTarget.value) return

  void navigateTo({
    path: route.path,
    query: {
      ...route.query,
      redirect: redirectTarget.value
    },
    hash: route.hash
  }, {
    replace: true
  })
})

async function submitLogin () {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await login(username.value, password.value)
    await navigateTo(redirectTarget.value)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Login failed.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 180px);
  min-height: calc(100dvh - 180px);
  padding: 28px 0;
}
.auth-card {
  width: min(100%, 460px);
  position: relative;
  overflow: hidden;
  animation: authEnter 0.58s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.auth-card::after {
  content: "";
  position: absolute;
  right: -24%;
  bottom: -28%;
  width: 70%;
  height: 180px;
  transform: rotate(-14deg);
  background: linear-gradient(90deg, rgba(118, 87, 255, 0.12), rgba(14, 165, 233, 0.1));
  animation: authRibbon 7s ease-in-out infinite;
}
.auth-mark {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 18px;
  border-radius: var(--radius-lg);
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 12px 26px rgba(118, 87, 255, 0.24);
  animation: markFloat 3.8s ease-in-out infinite;
}
.auth-form,
.register-prompt,
.login-error {
  position: relative;
  z-index: 1;
}
.login-error {
  color: var(--color-danger);
  font-size: .875rem;
  margin-top: 12px;
}
.register-prompt {
  margin-top: 18px;
  font-size: .875rem;
  color: var(--color-muted);
}
.register-prompt a {
  color: var(--color-primary);
  font-weight: 800;
  transition: color .18s ease;
}
.register-prompt a:hover {
  color: var(--color-primary-d);
}
.auth-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255,255,255,.35);
  border-top-color: #fff;
  border-radius: var(--radius-pill);
  animation: spin .7s linear infinite;
}
@keyframes authRibbon {
  0%, 100% { transform: translateX(0) rotate(-14deg); }
  50% { transform: translateX(-18px) rotate(-10deg); }
}
@media (max-width: 480px) {
  .auth-card .btn-primary {
    width: 100%;
  }
}
</style>
