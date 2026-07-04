export function runWhenIdle (callback: () => void, timeout = 2_000) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(() => callback(), { timeout })
    return
  }

  window.setTimeout(callback, 0)
}
