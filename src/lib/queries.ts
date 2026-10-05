import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Program, ProgramList } from './types'

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
