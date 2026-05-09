<template>
  <section class="register-page">
    <form class="register-card card" @submit.prevent="submitRegister">
      <h1 class="page-title">{{ $t('register.title') }}</h1>
      <p class="page-sub">{{ $t('register.subtitle') }}</p>

      <div class="form-group">
        <label class="form-label">{{ $t('register.username') }}</label>
        <input v-model="form.username" class="form-input" autocomplete="username" minlength="3" maxlength="64" required />
      </div>

      <div class="form-group">
        <label class="form-label">{{ $t('register.displayName') }}</label>
        <input v-model="form.displayName" class="form-input" autocomplete="name" maxlength="120" required />
      </div>

      <div class="form-group">
        <label class="form-label">{{ $t('register.password') }}</label>
        <input v-model="form.password" class="form-input" type="password" autocomplete="new-password" minlength="6" maxlength="128" required />
      </div>

      <div class="form-group">
        <label class="form-label">{{ $t('register.confirmPassword') }}</label>
        <input v-model="confirmPassword" class="form-input" type="password" autocomplete="new-password" minlength="6" maxlength="128" required />
      </div>

      <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? $t('register.creating') : $t('register.createAccount') }}
      </button>

      <p v-if="message" class="register-message" :class="{ 'register-message--error': hasError }">
        {{ message }}
      </p>

      <p class="login-prompt">
        {{ $t('register.alreadyHaveAccount') }}
        <NuxtLink to="/login">{{ $t('register.signIn') }}</NuxtLink>
      </p>
    </form>
  </section>
</template>

<script setup lang="ts">
definePageMeta({
  guestOnly: true
})

const { register } = useAuth()
const { t } = useI18n()

const form = reactive({
  username: '',
  displayName: '',
  password: ''
})
const confirmPassword = ref('')
const isSubmitting = ref(false)
const message = ref('')
const hasError = ref(false)

useHead({
  title: computed(() => `${t('register.title')} | TestPapers`)
})

async function submitRegister () {
  message.value = ''
  hasError.value = false

  if (form.password !== confirmPassword.value) {
    message.value = t('register.passwordsMismatch')
    hasError.value = true
    return
  }

  isSubmitting.value = true

  try {
    await register({
      username: form.username,
      displayName: form.displayName,
      password: form.password
    })
    await navigateTo('/questions')
  } catch (error) {
    message.value = error instanceof Error ? error.message : t('register.registrationFailed')
    hasError.value = true
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.register-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 180px);
}
.register-card {
  width: min(100%, 460px);
}
.register-message {
  margin-top: 12px;
  font-size: .875rem;
  color: var(--color-accent);
}
.register-message--error {
  color: var(--color-danger);
}
.login-prompt {
  margin-top: 18px;
  font-size: .875rem;
  color: var(--color-muted);
}
.login-prompt a {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
