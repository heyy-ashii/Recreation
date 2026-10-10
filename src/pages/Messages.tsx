import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MessageSquarePlus, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Modal, PageSpinner, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useUi } from '../context/UiContext'
import { api, errorMessage } from '../lib/api'
import type { MessageThread, PeerUser } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { useMessageThread, useMessageThreads, useStudentDirectory } from '../lib/queries'
import { cn, formatShort, formatTime } from '../lib/utils'

const initials = (name: string) => name.slice(0, 1).toUpperCase() || '?'

function Avatar({ user, size = 'md' }: { user: Pick<PeerUser, 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-brand/10 font-bold text-brand', size === 'sm' ? 'size-9 text-sm' : size === 'lg' ? 'size-12 text-base' : 'size-11 text-sm')}>
      {initials(user.name)}
    </span>
  )
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { toast } = useUi()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useMessageThread(id)
  const send = useMutation({
    mutationFn: (body: string) => api(`/messages/${id}`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['messages'] })
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  const messages = data?.messages ?? []
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) send.mutate(text.trim())
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <button className="btn-ghost p-2 md:hidden" onClick={onBack} aria-label="Back to conversations"><ArrowLeft className="size-4" /></button>
        {data?.conversation.peer && <Avatar user={data.conversation.peer} size="sm" />}
        <div className="min-w-0">
          <p className="truncate font-semibold">{data?.conversation.peer?.name ?? 'Conversation'}</p>
          {data?.conversation.peer?.username && <p className="truncate text-xs text-neutral-500">@{data.conversation.peer.username}</p>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-neutral-50 p-4 dark:bg-neutral-900/40">
        {isLoading ? (
          <div className="grid h-full place-items-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-neutral-500">Say hello to start the conversation.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m._id} className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.mine ? 'self-end rounded-br-sm bg-brand text-white' : 'self-start rounded-bl-sm bg-white shadow-sm dark:bg-neutral-800')}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.mine ? 'text-blue-100' : 'text-neutral-400')}>{formatTime(m.createdAt)}</p>
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <input className="input" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label="Message" />
        <button type="submit" className="btn-primary px-3" disabled={send.isPending || !text.trim()} aria-label="Send">
          {send.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}

function NewChatPicker({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: (id: string) => void }) {
  const qc = useQueryClient()
  const { toast } = useUi()
  const [q, setQ] = useState('')
  const { data, isLoading } = useStudentDirectory(q, open)
  const start = useMutation({
    mutationFn: (userId: string) => api<{ data: { conversation: MessageThread } }>('/messages/start', { method: 'POST', body: { userId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages'] })
      onClose()
      onStarted(res.data.conversation._id)
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  const users = data?.data.users ?? []

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <label className="sr-only" htmlFor="new-chat-search">Search students</label>
      <input id="new-chat-search" className="input" placeholder="Search by name or username…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="mt-4 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="grid place-items-center py-8"><Spinner /></div>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No students found.</p>
        ) : (
          users.map((u) => (
            <button
              key={u._id}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
              disabled={start.isPending}
              onClick={() => start.mutate(u._id)}
            >
              <Avatar user={u} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-xs text-neutral-500">@{u.username}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}

export default function Messages() {
  usePageMeta('Messages')
  const { user } = useAuth()
  const [selected, setSelected] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const { data: threads, isLoading } = useMessageThreads(Boolean(user))

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState title="Log in to see your messages">
          <Link to="/login" className="btn-primary mt-2">Log in</Link>
        </EmptyState>
      </div>
    )
  }

  const term = search.trim().toLowerCase()
  const list = (threads ?? []).filter((t) => {
    if (tab === 'unread' && t.unread === 0) return false
    if (!term) return true
    return t.peer?.name?.toLowerCase().includes(term) || t.peer?.username?.toLowerCase().includes(term) || t.lastMessage.toLowerCase().includes(term)
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Messages</h1>
          <p className="mt-1 text-sm text-neutral-500">Chat privately with other students.</p>
        </div>
        <button className="btn-primary px-3" onClick={() => setPicker(true)}>
          <MessageSquarePlus className="size-4" /> New
        </button>
      </div>

      <div className="card grid h-[calc(100vh-15rem)] min-h-[480px] overflow-hidden md:grid-cols-[340px_1fr]">
        <div className={cn('flex min-h-0 flex-col border-r border-neutral-200 dark:border-neutral-800', selected && 'hidden md:flex')}>
          <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
            <input className="input" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search messages" />
            <div className="mt-2 flex gap-1">
              {(['all', 'unread'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize', tab === t ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <PageSpinner />
            ) : list.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-500">
                {term || tab === 'unread' ? 'Nothing matches that filter.' : (
                  <>
                    <p>No conversations yet.</p>
                    <button className="btn-outline mt-3" onClick={() => setPicker(true)}>Start one</button>
                  </>
                )}
              </div>
            ) : (
              list.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelected(t._id)}
                  className={cn('flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40', selected === t._id && 'bg-blue-50 dark:bg-blue-950/40')}
                >
                  <Avatar user={t.peer} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{t.peer?.name ?? 'Student'}</span>
                      <span className="shrink-0 text-[11px] text-neutral-400">{formatShort(t.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-neutral-500">{t.lastMessage || 'No messages yet'}</span>
                      {t.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{t.unread}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className={cn('min-h-0', !selected && 'hidden md:block')}>
          {selected ? (
            <ThreadView key={selected} id={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-sm text-neutral-500">
              <div>
                <MessageSquarePlus className="mx-auto mb-2 size-6 opacity-40" aria-hidden />
                Select a conversation, or start a new one.
              </div>
            </div>
          )}
        </div>
      </div>

      <NewChatPicker open={picker} onClose={() => setPicker(false)} onStarted={(id) => setSelected(id)} />
    </div>
  )
}
