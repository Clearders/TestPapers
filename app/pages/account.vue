<template>
  <div class="account-page">
    <h1 class="page-title">Account Settings</h1>
    <p class="page-sub">Manage your profile, password, avatar, and account.</p>

    <div class="account-grid">
      <section class="card account-section">
        <h2 class="section-title">Profile</h2>
        <p class="section-desc">Update your username or display name.</p>

        <div class="form-group">
          <label class="form-label" for="profile-username">Username</label>
          <input
            id="profile-username"
            v-model="profileForm.username"
            type="text"
            name="username"
            autocomplete="username"
            spellcheck="false"
            class="form-input"
            :placeholder="user?.username"
            maxlength="64"
          />
          <span class="form-hint" v-if="profileForm.username && profileForm.username !== user?.username">
            Username can only be changed once every 30 days.
          </span>
        </div>

        <div class="form-group">
          <label class="form-label" for="profile-displayname">Display Name</label>
          <input
            id="profile-displayname"
            v-model="profileForm.displayName"
            type="text"
            name="displayName"
            autocomplete="off"
            class="form-input"
            :placeholder="user?.displayName"
            maxlength="120"
          />
        </div>

        <div class="section-actions">
          <button
            class="btn btn-primary"
            :disabled="profileSaving || !profileForm.username && !profileForm.displayName"
            @click="saveProfile"
          >
            {{ profileSaving ? 'Saving…' : 'Save Changes' }}
          </button>
          <span class="action-feedback" v-if="profileMessage" :class="{ 'is-error': profileError }" aria-live="polite">
            {{ profileMessage }}
          </span>
        </div>
      </section>

      <section class="card account-section">
        <h2 class="section-title">Password</h2>
        <p class="section-desc">Change your account password.</p>

        <div class="form-group">
          <label class="form-label" for="pwd-current">Current Password</label>
          <input
            id="pwd-current"
            v-model="passwordForm.currentPassword"
            type="password"
            name="current-password"
            autocomplete="current-password"
            class="form-input"
            placeholder="Enter current password\u2026"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="pwd-new">New Password</label>
          <input
            id="pwd-new"
            v-model="passwordForm.newPassword"
            type="password"
            name="new-password"
            autocomplete="new-password"
            class="form-input"
             placeholder="Enter new password (min 8 characters)…"
            minlength="8"
            maxlength="128"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="pwd-confirm">Confirm New Password</label>
          <input
            id="pwd-confirm"
            v-model="passwordForm.confirmPassword"
            type="password"
            name="new-password"
            autocomplete="new-password"
            class="form-input"
            placeholder="Confirm new password…"
          />
          <span class="form-hint" v-if="passwordMismatch">Passwords do not match</span>
        </div>

        <div class="section-actions">
          <button
            class="btn btn-primary"
            :disabled="passwordSaving || !canChangePassword"
            @click="savePassword"
          >
            {{ passwordSaving ? 'Changing…' : 'Change Password' }}
          </button>
          <span class="action-feedback" v-if="passwordMessage" :class="{ 'is-error': passwordError }" aria-live="polite">
            {{ passwordMessage }}
          </span>
        </div>
      </section>

      <section class="card account-section">
        <h2 class="section-title">Avatar</h2>
        <p class="section-desc">Upload or update your profile picture (PNG only, max 500KB).</p>

        <div class="avatar-section">
          <div class="avatar-preview">
            <img v-if="currentAvatarUrl" :src="currentAvatarUrl" alt="Current avatar" width="96" height="96" loading="lazy" />
            <span class="avatar-preview--placeholder" v-else>{{ initial }}</span>
          </div>

          <div class="avatar-actions">
            <label class="btn btn-outline avatar-upload-label">
              {{ avatarFile ? 'Change File' : 'Choose Image' }}
              <input
                type="file"
                accept="image/png"
                class="avatar-file-input"
                @change="handleAvatarSelected"
              />
            </label>
            <span class="form-hint" v-if="avatarFile">{{ avatarFile.name }}</span>
            <button
              v-if="avatarFile"
              class="btn btn-outline"
              type="button"
              @click="openCropper"
            >
              Edit
            </button>
            <button
              class="btn btn-primary"
              :disabled="avatarUploading || !avatarFile"
              @click="uploadAvatarFile"
            >
              {{ avatarUploading ? 'Uploading…' : 'Upload Avatar' }}
            </button>
          </div>
        </div>
        <span class="action-feedback" v-if="avatarMessage" :class="{ 'is-error': avatarError }" aria-live="polite">
          {{ avatarMessage }}
        </span>

        <AvatarCropper
          :file="avatarFile"
          :visible="showCropper"
          @close="showCropper = false"
          @cropped="onCropped"
        />
      </section>

      <section class="card account-section account-section--danger">
        <h2 class="section-title section-title--danger">Danger Zone</h2>
        <p class="section-desc">
          Once you delete your account, it will be deactivated. You will no longer be able to log in
          until an administrator reactivates your account. Your data will be preserved.
        </p>

        <div class="delete-confirm" v-if="showDeleteConfirm">
          <div class="form-group">
            <label class="form-label" for="delete-confirm-input">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-confirm-input"
              v-model="deleteConfirmText"
              type="text"
              name="delete-confirm"
              autocomplete="off"
              spellcheck="false"
              class="form-input"
              placeholder="DELETE…"
            />
          </div>
          <div class="section-actions">
            <button class="btn btn-outline" @click="showDeleteConfirm = false">Cancel</button>
            <button
              class="btn btn-danger"
              :disabled="deleteConfirmText.trim() !== 'DELETE' || deleteSaving"
              @click="handleDeleteAccount"
            >
              {{ deleteSaving ? 'Deleting…' : 'Delete Account' }}
            </button>
          </div>
        </div>
        <button v-else class="btn btn-danger" @click="showDeleteConfirm = true">
          Delete Account
        </button>
        <span class="action-feedback" v-if="deleteMessage" :class="{ 'is-error': deleteError }" aria-live="polite">
          {{ deleteMessage }}
        </span>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AvatarCropper from '~/components/AvatarCropper.vue'

definePageMeta({ requiresAuth: true })

useSeoMeta({
  title: 'Account Settings',
  description: 'Manage your TestPapers profile, update your avatar, and change your password.',
  robots: 'noindex, nofollow'
})

const { user, updateProfile, changePassword, uploadAvatar, deleteAccount } = useAuth()

const profileForm = reactive({ username: '', displayName: '' })
const profileSaving = ref(false)
const profileMessage = ref('')
const profileError = ref(false)

const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)
const passwordMessage = ref('')
const passwordError = ref(false)

const avatarFile = ref<File | null>(null)
const avatarUploading = ref(false)
const avatarMessage = ref('')
const avatarError = ref(false)
const showCropper = ref(false)

const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')
const deleteSaving = ref(false)
const deleteMessage = ref('')
const deleteError = ref(false)

const initial = computed(() => {
  const name = user.value?.displayName || user.value?.username || '?'
  return name.charAt(0).toUpperCase()
})

const currentAvatarUrl = computed(() => user.value?.avatarUrl || '')

const passwordMismatch = computed(() => {
  if (!passwordForm.confirmPassword) return false
  return passwordForm.newPassword !== passwordForm.confirmPassword
})

const canChangePassword = computed(() => {
  return passwordForm.currentPassword &&
    passwordForm.newPassword.length >= 8 &&
    passwordForm.confirmPassword.length > 0 &&
    !passwordMismatch.value
})

async function saveProfile () {
  if (!profileForm.username && !profileForm.displayName) return
  profileSaving.value = true
  profileError.value = false
  profileMessage.value = ''
  try {
    const payload: { username?: string; displayName?: string } = {}
    if (profileForm.username) payload.username = profileForm.username.toLowerCase().trim()
    if (profileForm.displayName) payload.displayName = profileForm.displayName.trim()
    await updateProfile(payload)
    profileForm.username = ''
    profileForm.displayName = ''
    profileMessage.value = 'Profile updated successfully.'
  } catch (err: any) {
    profileError.value = true
    const detail = err?.data?.detail
    profileMessage.value = detail?.message || 'Failed to update profile.'
  } finally {
    profileSaving.value = false
  }
}

async function savePassword () {
  if (!canChangePassword.value) return
  passwordSaving.value = true
  passwordError.value = false
  passwordMessage.value = ''
  try {
    await changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordMessage.value = 'Password changed successfully.'
  } catch (err: any) {
    passwordError.value = true
    const detail = err?.data?.detail
    passwordMessage.value = detail?.message || 'Failed to change password.'
  } finally {
    passwordSaving.value = false
  }
}

function handleAvatarSelected (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    avatarFile.value = file
  }
}

function openCropper() {
  showCropper.value = true
}

function onCropped(file: File) {
  avatarFile.value = file
  showCropper.value = false
}

async function uploadAvatarFile () {
  if (!avatarFile.value) return
  avatarUploading.value = true
  avatarError.value = false
  avatarMessage.value = ''
  try {
    await uploadAvatar(avatarFile.value)
    avatarFile.value = null
    avatarMessage.value = 'Avatar updated successfully.'
  } catch (err: any) {
    avatarError.value = true
    const detail = err?.data?.detail
    avatarMessage.value = detail?.message || 'Failed to upload avatar.'
  } finally {
    avatarUploading.value = false
  }
}

async function handleDeleteAccount () {
  if (deleteConfirmText.value.trim() !== 'DELETE') return
  deleteSaving.value = true
  deleteError.value = false
  deleteMessage.value = ''
  try {
    await deleteAccount()
  } catch (err: any) {
    deleteError.value = true
    const detail = err?.data?.detail
    deleteMessage.value = detail?.message || 'Failed to delete account.'
    deleteSaving.value = false
  }
}
</script>

<style scoped>
.account-page {
  max-width: 720px;
  margin: 0 auto;
}

.account-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.account-section {
  padding: 24px;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.section-title--danger {
  color: var(--color-danger);
}

.section-desc {
  font-size: .875rem;
  color: var(--color-muted);
  margin-bottom: 18px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.action-feedback {
  font-size: .85rem;
  color: var(--color-accent);
}

.action-feedback.is-error {
  color: var(--color-danger);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-preview {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--color-border);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--color-primary);
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
}

.avatar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.avatar-upload-label {
  cursor: pointer;
}

.avatar-file-input {
  display: none;
}

.delete-confirm {
  margin-top: 8px;
}

.account-section--danger {
  border-color: var(--color-danger);
}

[data-theme="dark"] .account-section--danger {
  border-color: rgba(248, 113, 113, 0.4);
}
</style>
