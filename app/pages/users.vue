<template>
  <section>
    <h1 class="page-title">User Permissions</h1>
    <p class="page-sub">Manage account roles for question authors, reviewers, and administrators.</p>

    <div v-if="!canManageUsers" class="card permission-card">
      <h2>Access restricted</h2>
      <p>Only administrators can manage users and roles.</p>
      <NuxtLink to="/login" class="btn btn-primary">Login as Admin</NuxtLink>
    </div>

    <div v-else class="users-layout">
      <form class="card user-form" @submit.prevent="createUser">
        <h2>Create User</h2>
        <div class="form-group">
          <label class="form-label" htmlFor="users-username">Username</label>
          <input id="users-username" v-model="form.username" class="form-input" autocomplete="off" required />
        </div>
        <div class="form-group">
          <label class="form-label" htmlFor="users-displayname">Display Name</label>
          <input id="users-displayname" v-model="form.displayName" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label" htmlFor="users-password">Password</label>
          <input id="users-password" v-model="form.password" class="form-input" type="password" autocomplete="new-password" minlength="6" required />
        </div>
        <div class="form-group">
          <label class="form-label" htmlFor="users-role">Role</label>
          <select id="users-role" v-model="form.role" class="form-input">
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Creating…' : 'Create User' }}
        </button>
        <p v-if="message" class="form-message" role="alert" aria-live="polite">{{ message }}</p>
      </form>

      <div class="user-list">
        <div v-for="item in users" :key="item.id" class="card user-card">
          <div>
            <h2>{{ item.displayName }}</h2>
            <p class="user-meta">@{{ item.username }} · {{ item.role }}</p>
          </div>
          <div class="user-controls">
            <select v-model="item.role" class="form-input" @change="updateUser(item)">
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="viewer">Viewer</option>
            </select>
            <label class="active-toggle">
              <input v-model="item.isActive" type="checkbox" @change="updateUser(item)" />
              <span>Active</span>
            </label>
            <button class="btn btn-danger btn-sm" type="button" :disabled="item.id === user?.id" @click="deleteUser(item.publicId)">
              Delete
            </button>
          </div>
          <div class="permission-list">
            <span v-for="permission in item.permissions" :key="permission" class="tag">{{ permission }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AuthUser, UserRole } from '~/composables/useAuth'

definePageMeta({
  requiresAuth: true,
  permissions: ['users:manage']
})

const { authFetch, hasPermission, isAuthReady, user } = useAuth()

const users = ref<AuthUser[]>([])
const isSaving = ref(false)
const message = ref('')
const canManageUsers = computed(() => hasPermission('users:manage'))

const form = reactive({
  username: '',
  displayName: '',
  password: '',
  role: 'viewer' as UserRole
})

useSeoMeta({
  title: 'User Permissions',
  description: 'Manage user roles and permissions for the TestPapers platform.',
  robots: 'noindex, nofollow'
})

watch(
  [isAuthReady, canManageUsers],
  ([ready, allowed]) => {
    if (ready && allowed) void loadUsers()
  },
  { immediate: true }
)

async function loadUsers () {
  const response = await authFetch<AuthUser[]>('/users', { method: 'GET' })
  users.value = response.data
}

async function createUser () {
  message.value = ''
  isSaving.value = true
  try {
    await authFetch<AuthUser>('/users', {
      method: 'POST',
      body: {
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role
      }
    })
    form.username = ''
    form.displayName = ''
    form.password = ''
    form.role = 'viewer'
    message.value = 'User created.'
    await loadUsers()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Failed to create user.'
  } finally {
    isSaving.value = false
  }
}

async function updateUser (item: AuthUser) {
  await authFetch<AuthUser>(`/users/${item.publicId}`, {
    method: 'PATCH',
    body: {
      role: item.role,
      isActive: item.isActive
    }
  })
  await loadUsers()
}

async function deleteUser (publicId: string) {
  if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
  await authFetch(`/users/${publicId}`, { method: 'DELETE' })
  users.value = users.value.filter(item => item.publicId !== publicId)
}
</script>

<style scoped>
.permission-card {
  max-width: 520px;
}
.permission-card h2,
.user-form h2,
.user-card h2 {
  font-size: 1rem;
  margin-bottom: 8px;
}
.users-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.user-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.user-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.user-meta,
.form-message {
  color: var(--color-muted);
  font-size: .875rem;
}
.user-controls,
.permission-list,
.active-toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.user-controls .form-input {
  flex: 1 1 180px;
}
.active-toggle {
  font-size: .875rem;
}
@media (max-width: 820px) {
  .users-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .user-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .user-controls .btn,
  .user-controls .form-input {
    width: 100%;
  }

  .permission-list .tag {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
}
</style>
