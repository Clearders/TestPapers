import { buildRealtimeUrl } from '~/utils/apiEndpoint'

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'
type RealtimeHandler = (payload: unknown) => void

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let reconnectAttempts = 0
const handlers = new Map<string, Set<RealtimeHandler>>()

function getRealtimeUrl () {
  const config = useRuntimeConfig()
  return buildRealtimeUrl(config.public.apiBase, config.public.wsBase)
}

function emit (event: string, payload: unknown) {
  const listeners = handlers.get(event)
  if (!listeners) return
  for (const handler of listeners) handler(payload)
}

function clearTimers () {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  reconnectTimer = null
  heartbeatTimer = null
}

export function useRealtime () {
  const { isAuthenticated, refreshSession } = useAuth()

  function disconnect () {
    clearTimers()
    reconnectAttempts = 0
    if (socket) {
      socket.onopen = null
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null
      socket.close()
      socket = null
    }
  }

  async function scheduleReconnect () {
    if (!isAuthenticated.value || reconnectTimer) return

    const refreshed = await refreshSession()
    if (!refreshed) return

    const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempts)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect () {
    if (import.meta.server || !isAuthenticated.value || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

    socket = new WebSocket(getRealtimeUrl())

    socket.onopen = () => {
      reconnectAttempts = 0
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: 'ping' }))
        }
      }, 25_000)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { event?: string, payload?: unknown }
        if (!message.event) return
        emit(message.event, message.payload)
      } catch {
      }
    }

    socket.onerror = () => {
    }

    socket.onclose = () => {
      clearTimers()
      socket = null
      void scheduleReconnect()
    }
  }

  function on (event: string, handler: RealtimeHandler) {
    const listeners = handlers.get(event) || new Set<RealtimeHandler>()
    listeners.add(handler)
    handlers.set(event, listeners)

    return () => {
      listeners.delete(handler)
      if (!listeners.size) handlers.delete(event)
    }
  }

  return {
    connect,
    disconnect,
    on
  }
}
