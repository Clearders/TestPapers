import { buildRealtimeUrl } from '~/utils/apiEndpoint'
import { createRealtimeReconnectBackoff } from '~/utils/realtimeBackoff'

type RealtimeHandler = (payload: unknown) => void
type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

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
  const status = useState<RealtimeStatus>('realtime-status', () => 'idle')
  const lastError = useState<string>('realtime-error', () => '')
  const isConnected = computed(() => status.value === 'open')

  function disconnect () {
    clearTimers()
    reconnectBackoff.reset()
    status.value = 'idle'
    lastError.value = ''
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
    status.value = 'reconnecting'

    const refreshed = await refreshSession()
    if (!refreshed) {
      status.value = 'idle'
      lastError.value = 'Live updates paused because your session could not be refreshed.'
      return
    }

    const delay = reconnectBackoff.nextDelay()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect () {
    if (import.meta.server) return
    if (!isAuthenticated.value) {
      status.value = 'idle'
      lastError.value = ''
      return
    }
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

    status.value = 'connecting'
    lastError.value = ''
    socket = new WebSocket(getRealtimeUrl())

    socket.onopen = () => {
      status.value = 'open'
      lastError.value = ''
      reconnectBackoff.markConnected()
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ event: 'ping' }))
          } catch {
            lastError.value = 'Live updates are temporarily unavailable. Reconnecting...'
            socket.close()
          }
        }
      }, 25_000)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { event?: string, payload?: unknown }
        if (!message.event) return
        emit(message.event, message.payload)
      } catch {
        // Ignore malformed realtime frames without breaking the connection.
      }
    }

    socket.onerror = () => {
      status.value = 'reconnecting'
      lastError.value = 'Live updates are temporarily unavailable. Reconnecting...'
    }

    socket.onclose = () => {
      clearTimers()
      socket = null
      if (isAuthenticated.value) {
        status.value = 'reconnecting'
        if (!lastError.value) lastError.value = 'Live updates paused. Reconnecting...'
        void scheduleReconnect()
      } else {
        status.value = 'idle'
        lastError.value = ''
      }
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
    isConnected,
    lastError,
    on
  }
}
