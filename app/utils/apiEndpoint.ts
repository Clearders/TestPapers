export const DEFAULT_API_BASE = 'http://127.0.0.1:8000/api/v1'
export const DEFAULT_WS_PATH = '/api/v1/ws'

export function normalizeEndpoint (value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback).replace(/\/+$/, '')
}

export function buildRealtimeUrl (apiBase: unknown, wsBase: unknown) {
  const configuredWsBase = normalizeEndpoint(wsBase, '')
  if (configuredWsBase) return configuredWsBase

  const normalizedApiBase = normalizeEndpoint(apiBase, DEFAULT_API_BASE)
  let apiUrl: URL
  try {
    apiUrl = new URL(normalizedApiBase || DEFAULT_API_BASE)
  } catch {
    apiUrl = new URL(DEFAULT_API_BASE)
  }
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  apiUrl.pathname = apiUrl.pathname.replace(/\/api\/v1\/?$/, DEFAULT_WS_PATH) || DEFAULT_WS_PATH
  apiUrl.search = ''
  apiUrl.hash = ''
  return apiUrl.toString()
}
