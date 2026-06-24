export interface ApiErrorInfo {
  code: string
  message: string
  status: number
}

type ErrorLike = {
  message?: unknown
  status?: unknown
  statusCode?: unknown
  response?: { status?: unknown }
  data?: {
    detail?: unknown
    error?: unknown
  }
}

export function getStatusCode (error: unknown) {
  if (!isRecord(error)) return 0
  const candidate = error as ErrorLike
  return numberOrZero(candidate.statusCode)
    || numberOrZero(candidate.status)
    || numberOrZero(candidate.response?.status)
}

export function extractApiErrorInfo (error: unknown): ApiErrorInfo {
  const candidate = isRecord(error) ? error as ErrorLike : {}
  const errorBody = candidate.data?.error ?? candidate.data?.detail
  const bodyRecord = isRecord(errorBody) ? errorBody : null
  const code = typeof bodyRecord?.code === 'string' ? bodyRecord.code : 'UNKNOWN_ERROR'
  const message = typeof bodyRecord?.message === 'string'
    ? bodyRecord.message
    : typeof candidate.message === 'string'
      ? candidate.message
      : 'An error occurred'

  return {
    status: getStatusCode(error),
    code,
    message
  }
}

export function apiErrorMessage (error: unknown, fallback: string) {
  if (!isRecord(error)) return fallback

  const candidate = error as ErrorLike
  const envelopeError = isRecord(candidate.data?.error) ? candidate.data.error : null
  if (typeof envelopeError?.message === 'string' && envelopeError.message.trim()) {
    const details = envelopeError.details
    if (Array.isArray(details) && details.length) {
      const firstDetail = details[0]
      if (isRecord(firstDetail) && typeof firstDetail.reason === 'string' && firstDetail.reason.trim()) {
        const field = typeof firstDetail.field === 'string' && firstDetail.field.trim() ? `${firstDetail.field}: ` : ''
        return `${field}${firstDetail.reason}`
      }
    }
    return envelopeError.message
  }

  const detail = candidate.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (isRecord(detail) && typeof detail.message === 'string' && detail.message.trim()) return detail.message
  if (Array.isArray(detail) && detail.length) {
    const firstDetail = detail[0]
    if (isRecord(firstDetail) && typeof firstDetail.msg === 'string' && firstDetail.msg.trim()) return firstDetail.msg
  }

  return typeof candidate.message === 'string' && candidate.message ? candidate.message : fallback
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrZero (value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
