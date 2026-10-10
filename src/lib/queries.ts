import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { MessageThread, PeerMessage, PostList, UserDirectory } from './types'

export type Stats = { users: number; admins: number; disabled: number; openChats: number; unreadMessages: number }

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
