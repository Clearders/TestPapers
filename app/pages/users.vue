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
          <label class="form-label">Username</label>
          <input v-model="form.username" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input v-model="form.displayName" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input v-model="form.password" class="form-input" type="password" minlength="6" required />
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select v-model="form.role" class="form-input">
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Creating...' : 'Create User' }}
        </button>
        <p v-if="message" class="form-message">{{ message }}</p>
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
            <button class="btn btn-danger btn-sm" type="button" :disabled="item.id === user?.id" @click="deleteUser(item.id)">
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

const { authFetch, hasPermission, loadSession, user } = useAuth()

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

useHead({
  title: 'User Permissions | TestPapers'
})

onMounted(async () => {
  await loadSession()
  if (canManageUsers.value) await loadUsers()
})

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
  await authFetch<AuthUser>(`/users/${item.id}`, {
    method: 'PATCH',
    body: {
      role: item.role,
      isActive: item.isActive
    }
  })
  await loadUsers()
}

async function deleteUser (id: number) {
  await authFetch(`/users/${id}`, { method: 'DELETE' })
  users.value = users.value.filter(item => item.id !== id)
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
  grid-template-columns: 320px minmax(0, 1fr);
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
.active-toggle {
  font-size: .875rem;
}
@media (max-width: 820px) {
  .users-layout {
    grid-template-columns: 1fr;
  }
}
</style>
