import type { DraftPresenceMember } from '~/types/draft'

const PRESENCE_HEARTBEAT_MS = 15_000

function isPresenceSnapshot (payload: unknown): payload is { draftId: string, members: DraftPresenceMember[] } {
  return typeof payload === 'object' && payload !== null &&
    'draftId' in payload && typeof payload.draftId === 'string' &&
    'members' in payload && Array.isArray(payload.members)
}

export function useDraftPresence (isEditing: Ref<boolean>) {
  const { isConnected, lastError, on, onConnected, send } = useRealtime()
  const activeDraftId = ref('')
  const members = ref<DraftPresenceMember[]>([])
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  function activity () {
    return isEditing.value ? 'editing' as const : 'viewing' as const
  }

  function publishPresence () {
    if (!activeDraftId.value) return false
    return send({
      event: 'draft.presence.update',
      draftId: activeDraftId.value,
      activity: activity()
    })
  }

  function subscribe () {
    if (!activeDraftId.value || !isConnected.value) return false
    const subscribed = send({ event: 'draft.subscribe', draftId: activeDraftId.value })
    if (subscribed) publishPresence()
    return subscribed
  }

  function activateDraft (draftId: string) {
    if (draftId === activeDraftId.value) {
      subscribe()
      return
    }
    if (activeDraftId.value) {
      send({ event: 'draft.unsubscribe', draftId: activeDraftId.value })
    }
    activeDraftId.value = draftId
    members.value = []
    subscribe()
  }

  function deactivateDraft () {
    if (activeDraftId.value) {
      send({ event: 'draft.unsubscribe', draftId: activeDraftId.value })
    }
    activeDraftId.value = ''
    members.value = []
  }

  on('draft.presence.snapshot', (payload) => {
    if (!isPresenceSnapshot(payload) || payload.draftId !== activeDraftId.value) return
    members.value = payload.members
  })
  onConnected(() => subscribe())

  watch(isEditing, () => publishPresence())

  if (import.meta.client) {
    heartbeatTimer = setInterval(() => publishPresence(), PRESENCE_HEARTBEAT_MS)
  }

  onScopeDispose(() => {
    deactivateDraft()
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  })

  return {
    presenceMembers: readonly(members),
    realtimeConnected: isConnected,
    realtimeError: lastError,
    activateDraft,
    deactivateDraft
  }
}
