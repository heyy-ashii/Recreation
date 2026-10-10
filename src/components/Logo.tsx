import { Link } from 'react-router-dom'

export default function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="DHGRAM home">
      <img
        src="/dhgram-logo.png"
        alt="DHGRAM"
        width={36}
        height={36}
        className="size-9 rounded-lg object-cover"
      />
      <span className="font-heading text-lg font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        <span className="text-brand">DH</span>GRAM
      </span>
    </Link>
  )
}
