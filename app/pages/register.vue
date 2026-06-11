<template>
  <section class="register-page">
    <form class="register-card card" @submit.prevent="submitRegister">
      <h1 class="page-title">Create Account</h1>
      <p class="page-sub">Register a viewer account for browsing shared question and paper resources.</p>

      <div class="form-group">
        <label class="form-label" htmlFor="register-username">Username</label>
        <input id="register-username" v-model="form.username" class="form-input" autocomplete="username" minlength="3" maxlength="64" required />
      </div>

      <div class="form-group">
        <label class="form-label" htmlFor="register-displayname">Display Name</label>
        <input id="register-displayname" v-model="form.displayName" class="form-input" autocomplete="name" maxlength="120" required />
      </div>

      <div class="form-group">
        <label class="form-label" htmlFor="register-password">Password</label>
        <input id="register-password" ref="registerPasswordInput" v-model="form.password" class="form-input" type="password" autocomplete="new-password" minlength="6" maxlength="128" required />
      </div>

      <div class="form-group">
        <label class="form-label" htmlFor="register-confirmpassword">Confirm Password</label>
        <input id="register-confirmpassword" v-model="confirmPassword" class="form-input" type="password" autocomplete="new-password" minlength="6" maxlength="128" required />
      </div>

      <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating…' : 'Create Account' }}
      </button>

      <p v-if="message" class="register-message" :class="{ 'register-message--error': hasError }" role="alert" aria-live="polite">
        {{ message }}
      </p>

      <p class="login-prompt">
        Already have an account?
        <NuxtLink to="/login">Sign in</NuxtLink>
      </p>
    </form>
  </section>
</template>

<script setup lang="ts">
definePageMeta({
  guestOnly: true
})

const { register } = useAuth()

const form = reactive({
  username: '',
  displayName: '',
  password: ''
})
const confirmPassword = ref('')
const registerPasswordInput = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)
const message = ref('')
const hasError = ref(false)

useHead({
  title: 'Create Account | TestPapers'
})

async function submitRegister () {
  message.value = ''
  hasError.value = false

  if (form.password !== confirmPassword.value) {
    message.value = 'Passwords do not match.'
    hasError.value = true
    registerPasswordInput.value?.focus()
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
    message.value = error instanceof Error ? error.message : 'Registration failed.'
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
  min-height: calc(100dvh - 180px);
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
@media (max-width: 480px) {
  .register-card .btn-primary {
    width: 100%;
  }
}
</style>
