import { ArrowRight, BadgeCheck, Compass, Share2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgramGrid, ProgramGridSkeleton } from '../components/ProgramCard'
import { EmptyState, ErrorState } from '../components/ui'
import { usePrograms } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'

const steps = [
  { icon: Compass, title: 'Discover', text: 'We collect opportunity posters from colleges, institutions, and organizations.' },
  { icon: BadgeCheck, title: 'Verify', text: 'Every submission is reviewed before being published on the platform.' },
  { icon: Share2, title: 'Share', text: 'Students discover opportunities through a modern, visual-first experience.' },
]

export default function Home() {
  usePageMeta()
  const { data, isLoading, error, refetch } = usePrograms({ limit: 8 })

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
          <Link to="/discover" className="btn-primary px-6 py-3">
            Explore Opportunities <ArrowRight className="size-4" />
          </Link>
          <Link to="/about" className="btn-outline px-6 py-3">
            Learn More
          </Link>
        </div>
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
