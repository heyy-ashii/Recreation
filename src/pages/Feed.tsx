import { Heart, MoreHorizontal, Pencil, Send, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageSpinner, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useUi } from '../context/UiContext'
import { api, errorMessage } from '../lib/api'
import type { Post } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { usePosts } from '../lib/queries'
import { cn, formatShort } from '../lib/utils'

function Composer({ onDone }: { onDone: () => void }) {
  const { toast } = useUi()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await api('/posts', { method: 'POST', body: { body: text.trim() } })
      setText('')
      toast('Posted')
      onDone()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="card p-4">
      <label className="sr-only" htmlFor="post-body">Your thought</label>
      <textarea
        id="post-body"
        className="input min-h-28 resize-y"
        placeholder="Share a thought with the DHGRAM community…"
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-neutral-400">{text.length}/2000</span>
        <button className="btn-primary" disabled={busy || !text.trim()}>
          {busy ? <Spinner className="size-4" /> : <Send className="size-4" />} Post
        </button>
      </div>
    </form>
  )
}

function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const { user, isAdmin } = useAuth()
  const { toast } = useUi()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)

  const canEdit = post.mine
  const canDelete = post.mine || isAdmin

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try {
      await fn()
      toast(msg)
      onChange()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    run(async () => {
      await api(`/posts/${post._id}`, { method: 'PATCH', body: { body: draft.trim() } })
      setEditing(false)
    }, 'Post updated')
  }

  return (
    <article className={cn('card p-4', post.hidden && 'opacity-60')}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
            {post.author.name.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold">{post.author.name || 'Student'}</p>
            <p className="text-xs text-neutral-400">
              @{post.author.username} · {formatShort(post.createdAt)}
            </p>
          </div>
        </div>
        {(canEdit || canDelete || isAdmin) && (
          <div className="relative">
            <button className="btn-ghost p-2" onClick={() => setMenu((m) => !m)} aria-label="Post actions">
              <MoreHorizontal className="size-4" />
            </button>
            {menu && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenu(false)} tabIndex={-1} />
                <div className="card absolute right-0 z-20 mt-1 w-44 overflow-hidden p-1 text-sm">
                  {canEdit && (
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => { setEditing(true); setMenu(false) }}>
                      <Pencil className="size-4" /> Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => { setMenu(false); run(() => api(`/posts/${post._id}`, { method: 'PATCH', body: { hidden: !post.hidden } }), post.hidden ? 'Post unhidden' : 'Post hidden') }}
                    >
                      <Sparkles className="size-4" /> {post.hidden ? 'Unhide' : 'Hide'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => { setMenu(false); run(() => api(`/posts/${post._id}`, { method: 'DELETE' }), 'Post deleted') }}
                    >
                      <Trash2 className="size-4" /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {post.hidden && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">Hidden from the public feed</p>}

      {editing ? (
        <form onSubmit={saveEdit} className="mt-3">
          <textarea className="input min-h-24" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setDraft(post.body) }}>Cancel</button>
            <button className="btn-primary" disabled={busy || !draft.trim()}>Save</button>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{post.body}</p>
      )}

      <footer className="mt-3 flex items-center gap-1">
        <button
          className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition', post.likedByMe ? 'bg-red-50 text-red-600 dark:bg-red-950' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800')}
          disabled={busy || !user}
          onClick={() => run(() => api(`/posts/${post._id}/like`, { method: 'POST' }), post.likedByMe ? 'Like removed' : 'Liked')}
          aria-label={post.likedByMe ? 'Unlike' : 'Like'}
        >
          <Heart className={cn('size-4', post.likedByMe && 'fill-current')} /> {post.likes}
        </button>
      </footer>
    </article>
  )
}

export default function Feed() {
  usePageMeta('Thoughts')
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = usePosts({ page, limit: 20 })
  const posts = data?.data.posts ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold">Thoughts</h1>
        <p className="mt-1 text-sm text-neutral-500">Share what's on your mind with the DHGRAM community.</p>
      </header>

      {user ? (
        <div className="mb-6">
          <Composer onDone={() => { setPage(1); refetch() }} />
        </div>
      ) : (
        <div className="card mb-6 flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Log in to share your thoughts and like posts.</p>
          <Link to="/login" className="btn-primary">Log in</Link>
        </div>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState title="No thoughts yet">Be the first to share something.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <PostCard key={p._id} post={p} onChange={() => refetch()} />
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <span className="text-sm text-neutral-500">Page {data.page} of {data.pages}</span>
          <button className="btn-outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
