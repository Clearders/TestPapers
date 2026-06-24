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
          <label class="form-label" for="users-username">Username</label>
          <input id="users-username" v-model="form.username" class="form-input" autocomplete="off" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="users-displayname">Display Name</label>
          <input id="users-displayname" v-model="form.displayName" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="users-password">Password</label>
          <input id="users-password" v-model="form.password" class="form-input" type="password" autocomplete="new-password" minlength="8" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="users-role">Role</label>
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
            <select v-model="item.role" class="form-input" aria-label="User role" @change="updateUser(item)">
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
import { apiErrorMessage } from '~/utils/apiError'

definePageMeta({
  requiresAuth: true,
  permissions: ['users:manage']
})

const { authFetch, hasPermission, isAuthReady, user } = useAuth()

const users = ref<AuthUser[]>([])
const usersOriginal = ref(new Map<string, { role: string, isActive: boolean }>())
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
  usersOriginal.value.clear()
  for (const u of users.value) {
    usersOriginal.value.set(u.publicId, { role: u.role, isActive: u.isActive })
  }
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
  } catch (err) {
    message.value = apiErrorMessage(err, 'Failed to create user.')
  } finally {
    isSaving.value = false
  }
}

async function updateUser (item: AuthUser) {
  const orig = usersOriginal.value.get(item.publicId)
  const body: Record<string, unknown> = {}
  if (!orig || item.role !== orig.role) body.role = item.role
  if (!orig || item.isActive !== orig.isActive) body.isActive = item.isActive
  if (!Object.keys(body).length) return
  try {
    await authFetch<AuthUser>(`/users/${item.publicId}`, {
      method: 'PATCH',
      body
    })
    await loadUsers()
  } catch (err) {
    message.value = apiErrorMessage(err, 'Failed to update user.')
    await loadUsers()
  }
}

async function deleteUser (publicId: string) {
  if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
  try {
    await authFetch(`/users/${publicId}`, { method: 'DELETE' })
    users.value = users.value.filter(item => item.publicId !== publicId)
  } catch (err) {
    message.value = apiErrorMessage(err, 'Failed to delete user.')
  }
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
.user-form {
  animation: revealLeft 0.52s cubic-bezier(0.16, 1, 0.3, 1) .08s both;
}
.user-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: revealRight 0.52s cubic-bezier(0.16, 1, 0.3, 1) .14s both;
}
.user-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.user-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--color-primary), var(--color-secondary));
  transform: scaleY(0);
  transform-origin: top;
  transition: transform .24s ease;
}
.user-card:hover::before {
  transform: scaleY(1);
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
  transition: color .18s ease, transform .18s ease;
}
.active-toggle:hover {
  color: var(--color-primary);
  transform: translateY(-1px);
}
.permission-list .tag {
  animation: permissionPop .28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes permissionPop {
  from { opacity: 0; transform: translateY(5px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
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
