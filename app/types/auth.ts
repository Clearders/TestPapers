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
  username: string
  displayName: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  token: string
  tokenType: 'bearer'
  expiresAt: string
  user: AuthUser
}

export interface RegisterPayload {
  username: string
  displayName: string
  password: string
}
