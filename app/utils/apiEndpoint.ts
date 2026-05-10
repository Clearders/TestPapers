export const DEFAULT_API_BASE = '/api/v1'
export const DEFAULT_SERVER_API_BASE = 'http://127.0.0.1:8000/api/v1'
export const DEFAULT_WS_PATH = '/api/v1/ws'

export function normalizeEndpoint (value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback).replace(/\/+$/, '')
}

function endpointToUrl (value: string, fallback: string) {
  const normalized = normalizeEndpoint(value, fallback)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(normalized || fallback, origin)
}

export function buildRealtimeUrl (apiBase: unknown, wsBase: unknown) {
  const configuredWsBase = normalizeEndpoint(wsBase, '')
  if (configuredWsBase) {
    const wsUrl = endpointToUrl(configuredWsBase, DEFAULT_WS_PATH)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : wsUrl.protocol === 'http:' ? 'ws:' : wsUrl.protocol
    return wsUrl.toString()
  }

  const normalizedApiBase = normalizeEndpoint(apiBase, DEFAULT_API_BASE)
  const apiUrl = endpointToUrl(normalizedApiBase, DEFAULT_API_BASE)
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  apiUrl.pathname = apiUrl.pathname.replace(/\/api\/v1\/?$/, DEFAULT_WS_PATH) || DEFAULT_WS_PATH
  apiUrl.search = ''
  apiUrl.hash = ''
  return apiUrl.toString()
}
