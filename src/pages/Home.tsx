import { ArrowRight, BadgeCheck, Compass, MessageSquare, Share2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgramGrid, ProgramGridSkeleton } from '../components/ProgramCard'
import { EmptyState, ErrorState } from '../components/ui'
import { usePrograms, usePosts } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'
import { formatShort } from '../lib/utils'

const steps = [
  { icon: Compass, title: 'Discover', text: 'We collect opportunity posters from colleges, institutions, and organizations.' },
  { icon: BadgeCheck, title: 'Verify', text: 'Every submission is reviewed before being published on the platform.' },
  { icon: Share2, title: 'Share', text: 'Students discover opportunities through a modern, visual-first experience.' },
]

export default function Home() {
  usePageMeta()
  const { data, isLoading, error, refetch } = usePrograms({ limit: 8 })
  const { data: thoughts } = usePosts({ limit: 3 })
  const posts = thoughts?.data.posts ?? []

  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <Sparkles className="size-4 text-brand" /> Curated for students
        </span>
        <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
          Explore Opportunities <span className="text-brand">Beyond Campus.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          Discover quizzes, workshops, paper presentations, hackathons, conferences, and competitions curated by OGEA.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/feed" className="btn-primary px-6 py-3">
            Share a Thought <MessageSquare className="size-4" />
          </Link>
          <Link to="/discover" className="btn-outline px-6 py-3">
            Explore Opportunities <ArrowRight className="size-4" />
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

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Recent Opportunities</h2>
            <p className="text-sm text-neutral-500">Latest additions to the platform</p>
          </div>
          <Link to="/discover" className="btn-ghost shrink-0">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        {isLoading ? (
          <ProgramGridSkeleton count={4} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data?.data.programs.length ? (
          <ProgramGrid programs={data.data.programs} />
        ) : (
          <EmptyState title="No opportunities yet">Check back soon — new opportunities are added regularly.</EmptyState>
        )}
      </section>

      <section className="border-y border-neutral-200 bg-white py-16 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold">How OGEA Works</h2>
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
