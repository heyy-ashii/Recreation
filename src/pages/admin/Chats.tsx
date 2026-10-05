import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MessageList } from '../../components/ChatWidget'
import { PageSpinner, Spinner, StatusBadge } from '../../components/ui'
import { useUi } from '../../context/UiContext'
import { api, errorMessage } from '../../lib/api'
import type { ChatMessage, Conversation } from '../../lib/types'
import { usePageMeta } from '../../lib/usePageMeta'
import { cn, formatShort } from '../../lib/utils'

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { toast } = useUi()
  const [text, setText] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chat', id],
    queryFn: () => api<{ data: { conversation: Conversation; messages: ChatMessage[] } }>(`/chat/conversations/${id}/messages`).then((r) => r.data),
    refetchInterval: 5000,
  })
  const send = useMutation({
    mutationFn: (body: string) => api(`/chat/conversations/${id}/messages`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  const setStatus = useMutation({
    mutationFn: (status: 'open' | 'closed') => api(`/chat/conversations/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) send.mutate(text.trim())
  }

  if (isLoading || !data) return <PageSpinner />
  const { conversation, messages } = data
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <button className="btn-ghost p-2 md:hidden" onClick={onBack} aria-label="Back to conversations"><ArrowLeft className="size-4" /></button>
          <div>
            <p className="font-semibold">{conversation.user?.name ?? 'Deleted user'}</p>
            <p className="text-xs text-neutral-500">@{conversation.user?.username} {conversation.user?.email && `· ${conversation.user.email}`}</p>
          </div>
        </div>
        <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setStatus.mutate(conversation.status === 'open' ? 'closed' : 'open')}>
          Mark {conversation.status === 'open' ? 'resolved' : 'open'}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} mine="admin" />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <input className="input" placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label="Reply" />
        <button className="btn-primary px-3" disabled={send.isPending || !text.trim()} aria-label="Send reply">
          {send.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}

export default function Chats() {
  usePageMeta('Chats · Admin')
  const [filter, setFilter] = useState<'open' | 'closed' | ''>('open')
  const [selected, setSelected] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'conversations', filter],
    queryFn: () => api<{ data: { conversations: Conversation[] } }>('/chat/conversations', { query: { status: filter } }).then((r) => r.data.conversations),
    refetchInterval: 10000,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold">Chat inbox</h1>
      <div className="card mt-6 grid h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
        <div className={cn('flex flex-col border-r border-neutral-200 dark:border-neutral-800', selected && 'hidden md:flex')}>
          <div className="flex gap-1 border-b border-neutral-200 p-2 dark:border-neutral-800">
            {(['open', 'closed', ''] as const).map((f) => (
              <button key={f || 'all'} onClick={() => setFilter(f)} className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize', filter === f ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800')}>
                {f || 'all'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <PageSpinner />
            ) : data?.length ? (
              data.map((c) => (
                <button key={c._id} onClick={() => setSelected(c._id)} className={cn('flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40', selected === c._id && 'bg-blue-50 dark:bg-blue-950/40')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{c.user?.name ?? 'Deleted user'}</span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {formatShort(c.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-neutral-500">{c.lastMessage}</span>
                    {c.unreadForAdmin > 0 ? <span className="rounded-full bg-brand px-1.5 text-xs font-bold text-white">{c.unreadForAdmin}</span> : filter === '' && <StatusBadge status={c.status} />}
                  </div>
                </button>
              ))
            ) : (
              <p className="p-6 text-center text-sm text-neutral-500">No conversations.</p>
            )}
          </div>
        </div>
        <div className={cn('min-h-0', !selected && 'hidden md:block')}>
          {selected ? <Thread key={selected} id={selected} onBack={() => setSelected(null)} /> : <p className="grid h-full place-items-center text-sm text-neutral-500">Select a conversation</p>}
        </div>
      </div>
    </div>
  )
}
