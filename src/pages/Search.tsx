import { Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProgramGrid, ProgramGridSkeleton } from '../components/ProgramCard'
import { EmptyState, ErrorState } from '../components/ui'
import { useCategories, usePrograms } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'

export default function Search() {
  usePageMeta('Search Opportunities')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('category') || 'All'
  const status = params.get('status') || ''
  const sort = params.get('sort') || 'newest'
  const [text, setText] = useState(q)
  const { data: categories } = useCategories()

  useEffect(() => {
    const t = setTimeout(() => update('q', text.trim()), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function update(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value || value === 'All' || (key === 'sort' && value === 'newest')) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const clear = () => {
    setText('')
    setParams({}, { replace: true })
  }

  const { data, isLoading, error, refetch } = usePrograms({ q, category, status, sort, limit: 100 })
  const hasFilters = Boolean(q || status || category !== 'All' || sort !== 'newest')

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">Search Opportunities</h1>
      <p className="mt-2 text-neutral-500">Find exactly what you&apos;re looking for</p>

      <div className="card mt-8 grid gap-4 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            className="input pl-9"
            placeholder="Search opportunities..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Search opportunities"
            autoFocus
          />
        </div>
        <select className="input" value={category} onChange={(e) => update('category', e.target.value)} aria-label="Filter by Category">
          <option value="All">All categories</option>
          {categories?.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => update('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="Live">Live</option>
          <option value="Recent">Recent</option>
          <option value="Closed">Closed</option>
        </select>
        <select className="input" value={sort} onChange={(e) => update('sort', e.target.value)} aria-label="Sort By">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="deadline">Deadline soonest</option>
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
        <span>{data ? `${data.total} result${data.total === 1 ? '' : 's'}` : ' '}</span>
        {hasFilters && (
          <button className="btn-ghost px-2 py-1" onClick={clear}>
            <X className="size-4" /> Clear filters
          </button>
        )}
      </div>

      <div className="mt-4">
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
