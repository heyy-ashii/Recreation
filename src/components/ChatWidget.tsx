import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUi } from '../context/UiContext'
import { api, errorMessage } from '../lib/api'
import type { ChatMessage } from '../lib/types'
import { cn, formatTime } from '../lib/utils'
import AuthPanel from './AuthPanel'
import { Spinner } from './ui'

export function MessageList({ messages, mine }: { messages: ChatMessage[]; mine: 'user' | 'admin' }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length])
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => (
        <div key={m._id} className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.senderRole === mine ? 'self-end rounded-br-sm bg-brand text-white' : 'self-start rounded-bl-sm bg-neutral-100 dark:bg-neutral-800')}>
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <p className={cn('mt-1 text-[10px]', m.senderRole === mine ? 'text-blue-100' : 'text-neutral-400')}>{formatTime(m.createdAt)}</p>
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}

function ChatThread() {
  const qc = useQueryClient()
  const { toast } = useUi()
  const [text, setText] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['chat', 'me'],
    queryFn: () => api<{ data: { messages: ChatMessage[] } }>('/chat/me'),
    refetchInterval: 5000,
  })
  const send = useMutation({
    mutationFn: (body: string) => api('/chat/me/messages', { method: 'POST', body: { body } }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['chat'] })
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) send.mutate(text.trim())
  }
  const messages = data?.data.messages ?? []

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid h-full place-items-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-neutral-500">Hi! Send a message and the OGEA admin team will reply here.</p>
        ) : (
          <MessageList messages={messages} mine="user" />
        )}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <input className="input" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label="Message" />
        <button type="submit" className="btn-primary px-3" disabled={send.isPending || !text.trim()} aria-label="Send">
          {send.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </button>
      </form>
    </>
  )
}

export default function ChatWidget() {
  const { chatOpen, setChatOpen } = useUi()
  const { user } = useAuth()
  const { data: unread } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: () => api<{ data: { unread: number } }>('/chat/me/unread').then((r) => r.data.unread),
    enabled: Boolean(user) && !chatOpen && user?.role !== 'admin',
    refetchInterval: 30000,
  })
  if (user?.role === 'admin') return null

  return (
    <>
      {!chatOpen && (
        <button
          className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-brand text-white shadow-xl transition hover:scale-105 md:bottom-6"
          onClick={() => setChatOpen(true)}
          aria-label="Chat with Admin"
        >
          <MessageCircle className="size-6" />
          {Boolean(unread) && (
            <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold">{unread}</span>
          )}
        </button>
      )}
      {chatOpen && (
        <section
          className="card fixed inset-x-2 bottom-2 z-50 flex h-[75vh] flex-col overflow-hidden shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[380px]"
          aria-label="Chat with Admin"
        >
          <header className="flex items-center justify-between bg-neutral-900 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Chat with Admin</p>
              <p className="text-xs text-neutral-300">We usually reply within a few hours</p>
            </div>
            <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setChatOpen(false)} aria-label="Close chat">
              <X className="size-5" />
            </button>
          </header>
          {user ? (
            <ChatThread />
          ) : (
            <div className="overflow-y-auto p-4">
              <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                Log in or create a free account to chat with the admin.
              </p>
              <AuthPanel compact />
            </div>
          )}
        </section>
      )}
    </>
  )
}
