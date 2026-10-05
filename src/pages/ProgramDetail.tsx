import { ArrowLeft, Building2, CalendarDays, Clock, ExternalLink, MapPin, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, PageSpinner, StatusBadge } from '../components/ui'
import { useUi } from '../context/UiContext'
import { useProgram } from '../lib/queries'
import { usePageMeta } from '../lib/usePageMeta'
import { cn, formatDate, linkify, optimizeImage } from '../lib/utils'

function RichText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300">
      {linkify(text).map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.value}</span>
        const href = p.type === 'email' ? `mailto:${p.value}` : p.type === 'phone' ? `tel:${p.value.replace(/[\s-]/g, '')}` : p.value
        return (
          <a key={i} href={href} className="font-medium text-brand hover:underline" target={p.type === 'url' ? '_blank' : undefined} rel="noreferrer">
            {p.value}
          </a>
        )
      })}
    </div>
  )
}

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useUi()
  const { data: program, isLoading, error, refetch } = useProgram(id)
  const [active, setActive] = useState(0)
  usePageMeta(program?.title, program ? `${program.category} · ${program.organizer ?? ''}`.trim() : undefined)

  if (isLoading) return <PageSpinner />
  if (error || !program)
    return (
      <div className="px-4 py-16">
        <ErrorState message={error?.message ?? 'Program not found'} onRetry={() => refetch()} />
        <div className="mt-4 text-center"><Link to="/discover" className="btn-ghost">Back to Discover</Link></div>
      </div>
    )

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: program.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied to clipboard')
      }
    } catch {
      /* user cancelled */
    }
  }

  const facts = [
    { icon: Building2, label: 'Organizer', value: program.organizer },
    { icon: MapPin, label: 'Venue', value: program.venue },
    { icon: CalendarDays, label: 'Event date', value: program.eventDate && formatDate(program.eventDate) },
    { icon: Clock, label: 'Deadline', value: program.deadline && formatDate(program.deadline) },
  ].filter((f) => f.value)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))} className="btn-ghost -ml-3 mb-6">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          {program.imageurls.length > 0 && (
            <>
              <a href={program.imageurls[active]} target="_blank" rel="noreferrer" title="Open full-size image">
                <img src={optimizeImage(program.imageurls[active], 1000)} alt={program.title} className="w-full rounded-2xl border border-neutral-200 shadow-sm dark:border-neutral-800" />
              </a>
              {program.imageurls.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {program.imageurls.map((u, i) => (
                    <button key={u} onClick={() => setActive(i)} className={cn('shrink-0 overflow-hidden rounded-lg border-2', i === active ? 'border-brand' : 'border-transparent')} aria-label={`Show image ${i + 1}`}>
                      <img src={optimizeImage(u, 160)} alt="" className="size-20 object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-neutral-800">{program.category}</span>
            <StatusBadge status={program.status} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{program.title}</h1>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"><f.icon className="size-4" /> {f.label}</dt>
                <dd className="mt-1 font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            {program.registrationLink && (
              <a href={program.registrationLink} target="_blank" rel="noreferrer" className="btn-primary">
                Apply / Register <ExternalLink className="size-4" />
              </a>
            )}
            <button className="btn-outline" onClick={share}><Share2 className="size-4" /> Share</button>
          </div>
          {program.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {program.tags.map((t) => (
                <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="rounded-full border border-neutral-200 px-3 py-1 text-xs hover:border-brand dark:border-neutral-800">#{t}</Link>
              ))}
            </div>
          )}
          {program.about && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold">About</h2>
              <RichText text={program.about} />
            </section>
          )}
          {program.contact && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-bold">Contact</h2>
              <RichText text={program.contact} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
