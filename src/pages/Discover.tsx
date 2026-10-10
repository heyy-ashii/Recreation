import { Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProgramGrid, ProgramGridSkeleton } from '../components/ProgramCard'
import { EmptyState, ErrorState } from '../components/ui'
import { useCategories, usePrograms } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'
import { cn } from '../lib/utils'

export default function Discover() {
  usePageMeta('Explore Opportunities', 'Browse curated opportunities: writing, poems, quizzes, seminars, conferences and more.')
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || 'All'
  const q = params.get('q') || ''
  const [text, setText] = useState(q)
  const { data: categories } = useCategories()
  const { data, isLoading, error, refetch, isFetching } = usePrograms({ q, category, limit: 100 })

  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (text.trim()) next.set('q', text.trim())
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const select = (c: string) => setParams(c === 'All' ? {} : { category: c }, { replace: true })
  const clear = () => {
    setText('')
    setParams({}, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Explore Opportunities</h1>
      <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
        Browse through curated opportunities from across campuses. Find hackathons, workshops, debates, and more to accelerate your journey.
      </p>

      <div className="card mt-8 p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            className="input pl-9"
            placeholder="Search opportunities..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Search opportunities"
          />
          {text && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white" onClick={() => setText('')} aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="toolbar" aria-label="Filter by category">
          {['All', ...(categories?.map((c) => c.name) ?? [])].map((c) => (
            <button
              key={c}
              onClick={() => select(c)}
              aria-pressed={category === c}
              className={cn(
                'chip shrink-0',
                category === c
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('mt-8 transition-opacity', isFetching && !isLoading && 'opacity-60')}>
        {isLoading ? (
          <ProgramGridSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data?.data.programs.length ? (
          <ProgramGrid programs={data.data.programs} />
        ) : (
          <EmptyState title="No opportunities found">
            <button className="btn-outline" onClick={clear}>Clear Filters</button>
          </EmptyState>
        )}
      </div>
    </div>
  )
}
