export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, string | number | undefined | null> }

export async function api<T>(path: string, { body, query, headers, ...init }: Options = {}): Promise<T> {
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][],
      ).toString()
    : ''
  const isForm = body instanceof FormData
  const res = await fetch(`/api/v1${path}${qs === '?' ? '' : qs}`, {
    credentials: 'include',
    ...init,
    headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status)
  return data as T
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')
