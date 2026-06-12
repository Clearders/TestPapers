export type Permission =
  | 'questions:read'
  | 'questions:write'
  | 'questions:delete'
  | 'answers:read'
  | 'papers:read'
  | 'papers:write'
  | 'users:manage'

export type UserRole = 'admin' | 'teacher' | 'viewer'

export interface AuthUser {
  id: number
  publicId: string
  username: string
  displayName: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  expiresAt: string
  user: AuthUser
}

export interface RegisterPayload {
  username: string
  displayName: string
  password: string
}

export interface ProfileUpdatePayload {
  username?: string
  displayName?: string
}

export interface PasswordChangePayload {
  currentPassword: string
  newPassword: string
}
