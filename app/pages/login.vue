<template>
  <section class="login-page">
    <div class="login-card card">
      <h1 class="page-title">Login</h1>
      <p class="page-sub">Sign in to access the question bank and protected authoring tools.</p>

      <form @submit.prevent="submitLogin">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input v-model="username" class="form-input" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input v-model="password" class="form-input" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Signing in...' : 'Sign In' }}
        </button>
        <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
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

definePageMeta({
  guestOnly: true
})

const { login } = useAuth()
const route = useRoute()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

useHead({
  title: 'Login | TestPapers'
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
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 180px);
  min-height: calc(100dvh - 180px);
}
.login-card {
  width: min(100%, 440px);
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
  font-weight: 600;
}
@media (max-width: 480px) {
  .login-card .btn-primary {
    width: 100%;
  }
}
</style>
