import { buildRealtimeUrl } from '~/utils/apiEndpoint'
import { createRealtimeReconnectBackoff } from '~/utils/realtimeBackoff'

type RealtimeHandler = (payload: unknown) => void

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
const handlers = new Map<string, Set<RealtimeHandler>>()
const reconnectBackoff = createRealtimeReconnectBackoff()

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
  reconnectBackoff.cancelStableReset()
}

export function useRealtime () {
  const { isAuthenticated, refreshSession } = useAuth()

  function disconnect () {
    clearTimers()
    reconnectBackoff.reset()
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

    const delay = reconnectBackoff.nextDelay()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect () {
    if (import.meta.server || !isAuthenticated.value || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

    socket = new WebSocket(getRealtimeUrl())

    socket.onopen = () => {
      reconnectBackoff.markConnected()
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
        console.warn('[Realtime] Failed to parse message', event.data)
      }
    }

    socket.onerror = (event) => {
      console.error('[Realtime] WebSocket error', event)
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

    if (getCurrentScope()) {
      onScopeDispose(() => {
        listeners.delete(handler)
        if (!listeners.size) handlers.delete(event)
      })
    }

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
