type TimerHandle = ReturnType<typeof setTimeout>

type RealtimeReconnectBackoffOptions = {
  baseDelayMs?: number
  maxDelayMs?: number
  stableConnectionMs?: number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

export function createRealtimeReconnectBackoff (options: RealtimeReconnectBackoffOptions = {}) {
  const {
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    stableConnectionMs = 30_000,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = options

  let reconnectAttempts = 0
  let stableConnectionTimer: TimerHandle | null = null

  function clearStableConnectionTimer () {
    if (stableConnectionTimer !== null) clearTimeoutFn(stableConnectionTimer)
    stableConnectionTimer = null
  }

  return {
    nextDelay () {
      clearStableConnectionTimer()
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** reconnectAttempts)
      reconnectAttempts += 1
      return delay
    },

    markConnected () {
      clearStableConnectionTimer()
      stableConnectionTimer = setTimeoutFn(() => {
        reconnectAttempts = 0
        stableConnectionTimer = null
      }, stableConnectionMs)
    },

    cancelStableReset () {
      clearStableConnectionTimer()
    },

    reset () {
      clearStableConnectionTimer()
      reconnectAttempts = 0
    }
  }
}
