import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { MessageThread, PeerMessage, PostList, Program, ProgramList, UserDirectory } from './types'

export type ProgramFilters = { q?: string; category?: string; status?: string; sort?: string; limit?: number; page?: number }

export const usePrograms = (filters: ProgramFilters = {}) =>
  useQuery({
    queryKey: ['programs', filters],
    queryFn: () => api<ProgramList>('/programs', { query: { ...filters, category: filters.category === 'All' ? undefined : filters.category } }),
    placeholderData: (prev) => prev,
  })

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ data: { categories: { name: string; count: number }[] } }>('/programs/categories').then((r) => r.data.categories),
    staleTime: 5 * 60_000,
  })

export const useProgram = (id?: string) =>
  useQuery({
    queryKey: ['program', id],
    queryFn: () => api<{ data: { program: Program } }>(`/programs/${id}`).then((r) => r.data.program),
    enabled: Boolean(id),
  })

export type Stats = { users: number; admins: number; disabled: number; programs: number; livePrograms: number; openChats: number; unreadMessages: number }

export const useStats = () =>
  useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<{ data: Stats }>('/admin/stats').then((r) => r.data), refetchInterval: 30000 })

export const usePosts = ({ page = 1, limit = 20, mine = false }: { page?: number; limit?: number; mine?: boolean } = {}) =>
  useQuery({
    queryKey: ['posts', { page, limit, mine }],
    queryFn: () => api<PostList>('/posts', { query: { page, limit, mine: mine ? 'true' : undefined } }),
    placeholderData: (prev) => prev,
  })

export const useMessageThreads = (enabled = true) =>
  useQuery({
    queryKey: ['messages', 'list'],
    queryFn: () => api<{ data: { conversations: MessageThread[] } }>('/messages').then((r) => r.data.conversations),
    enabled,
    refetchInterval: 10000,
  })

export const useMessageThread = (id?: string) =>
  useQuery({
    queryKey: ['messages', id],
    queryFn: () => api<{ data: { conversation: MessageThread; messages: PeerMessage[] } }>(`/messages/${id}`).then((r) => r.data),
    enabled: Boolean(id),
    refetchInterval: 5000,
  })

export const useStudentDirectory = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['messages', 'directory', q],
    queryFn: () => api<UserDirectory>('/messages/directory', { query: { q, limit: 30 } }),
    enabled,
  })
