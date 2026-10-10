import { ArrowRight, MessageCircle, MessageSquare, Sparkles, Timer, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'
import { usePosts } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'
import { formatShort } from '../lib/utils'

const steps = [
  { icon: MessageSquare, title: 'Share thoughts', text: 'Any signed-in student can post a thought to the public feed.' },
  { icon: Users, title: 'Chat with anyone', text: 'Open Messages to find every student and start a conversation.' },
  { icon: Timer, title: 'Stays fresh', text: 'Messages clear automatically after 30 days, so nothing piles up.' },
]

export default function Home() {
  usePageMeta()
  const { data: thoughts } = usePosts({ limit: 3 })
  const posts = thoughts?.data.posts ?? []

  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <Sparkles className="size-4 text-brand" /> Chat & thoughts for students
        </span>
        <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
          Share your thoughts. <span className="text-brand">Message anyone.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          DHGRAM is a simple space for students to post thoughts and talk to each other, one-to-one.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/feed" className="btn-primary px-6 py-3">
            Share a Thought <MessageSquare className="size-4" />
          </Link>
          <Link to="/messages" className="btn-outline px-6 py-3">
            Open Messages <MessageCircle className="size-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Latest Thoughts</h2>
            <p className="text-sm text-neutral-500">What the community is talking about</p>
          </div>
          <Link to="/feed" className="btn-ghost shrink-0">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        {posts.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p._id} to="/feed" className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    {p.author.name.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{p.author.name || 'Student'}</p>
                    <p className="text-xs text-neutral-400">{formatShort(p.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{p.body}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No thoughts yet">Be the first to share something on the Thoughts page.</EmptyState>
        )}
      </section>

      <section className="border-y border-neutral-200 bg-white py-16 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold">How DHGRAM Works</h2>
          <p className="mt-1 text-center text-sm text-neutral-500">Simple. Reliable. Student focused.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="card p-6">
                <s.icon className="size-8 text-brand" />
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
