import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Program } from '../lib/types'
import { daysLeft, optimizeImage } from '../lib/utils'

export default function ProgramCard({ program }: { program: Program }) {
  const left = program.status === 'Live' ? daysLeft(program.deadline) : null
  return (
    <Link
      to={`/programs/${program._id}`}
      className="group mb-5 block break-inside-avoid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="relative">
        {program.imageurls[0] ? (
          <img
            src={optimizeImage(program.imageurls[0], 600)}
            alt={program.title}
            loading="lazy"
            decoding="async"
            className="w-full object-cover"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-blue-100 to-indigo-200 p-6 text-center font-bold text-blue-900">
            {program.title}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur">
          {program.category}
        </span>
        {program.status === 'Closed' && (
          <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Closed</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand">{program.title}</h3>
        {program.organizer && <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{program.organizer}</p>}
        {left !== null && left >= 0 && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
            <CalendarClock className="size-3.5" /> {left === 0 ? 'Closes today' : `${left} day${left === 1 ? '' : 's'} left`}
          </p>
        )}
      </div>
    </Link>
  )
}

export function ProgramGrid({ programs }: { programs: Program[] }) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
      {programs.map((p) => (
        <ProgramCard key={p._id} program={p} />
      ))}
    </div>
  )
}

export function ProgramGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mb-5 animate-pulse break-inside-avoid rounded-2xl bg-neutral-200 dark:bg-neutral-800" style={{ height: 220 + ((i * 67) % 160) }} />
      ))}
    </div>
  )
}
