<template>
  <section class="login-page">
    <div class="login-card card">
      <h1 class="page-title">{{ $t('login.title') }}</h1>
      <p class="page-sub">{{ $t('login.subtitle') }}</p>

      <form @submit.prevent="submitLogin">
        <div class="form-group">
          <label class="form-label">{{ $t('login.username') }}</label>
          <input v-model="username" class="form-input" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('login.password') }}</label>
          <input v-model="password" class="form-input" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? $t('login.signingIn') : $t('login.signIn') }}
        </button>
        <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
      </form>

      <div class="demo-users">
        <span class="form-hint">{{ $t('login.demoAccounts') }}</span>
        <button class="btn btn-outline btn-sm" type="button" @click="fillDemo('admin', 'admin123')">{{ $t('login.admin') }}</button>
        <button class="btn btn-outline btn-sm" type="button" @click="fillDemo('teacher', 'teacher123')">{{ $t('login.teacher') }}</button>
        <button class="btn btn-outline btn-sm" type="button" @click="fillDemo('viewer', 'viewer123')">{{ $t('login.viewer') }}</button>
      </div>

      <p class="register-prompt">
        {{ $t('login.noAccount') }}
        <NuxtLink to="/register">{{ $t('login.createOne') }}</NuxtLink>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({
  guestOnly: true
})

const { login } = useAuth()
const { t } = useI18n()
const route = useRoute()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

useHead({
  title: computed(() => `${t('login.title')} | TestPapers`)
})

function fillDemo (name: string, pass: string) {
  username.value = name
  password.value = pass
}

async function submitLogin () {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await login(username.value, password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/questions')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('login.loginFailed')
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
}
.login-card {
  width: min(100%, 440px);
}
.demo-users {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
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
</style>
