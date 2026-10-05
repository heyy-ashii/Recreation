import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="OGEA home">
      <span className="grid size-8 place-items-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
        <Sparkles className="size-4" />
      </span>
      <span className="font-heading text-lg font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        OGEA
      </span>
    </Link>
  )
}
