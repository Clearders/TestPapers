export interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: {
    requestId?: string
  }
}

export interface ApiPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedData<T> {
  items: T[]
  pagination: ApiPagination
}
