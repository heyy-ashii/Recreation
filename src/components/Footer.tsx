import { Mail, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUi } from '../context/UiContext'
import { CONTACT_EMAIL, CREATOR_NAME } from '../lib/utils'
import Logo from './Logo'

const YEAR = new Date().getFullYear()

export default function Footer() {
  const { setChatOpen } = useUi()
  return (
    <footer className="border-t border-neutral-200 bg-white pb-20 pt-12 md:pb-10 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-neutral-500">
            Opportunities beyond campus — quizzes, workshops, competitions and conferences curated for students.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Explore</h3>
          <ul className="space-y-2 text-sm text-neutral-500">
            <li><Link className="hover:text-brand" to="/discover">Explore</Link></li>
            <li><Link className="hover:text-brand" to="/feed">Thoughts</Link></li>
            <li><Link className="hover:text-brand" to="/about">About</Link></li>
            <li><Link className="hover:text-brand" to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Get in touch</h3>
          <div className="flex flex-col gap-2">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-outline justify-start" aria-label={`Email ${CONTACT_EMAIL}`}>
              <Mail className="size-4" /> {CONTACT_EMAIL}
            </a>
            <button type="button" className="btn-primary justify-start" onClick={() => setChatOpen(true)}>
              <MessageCircle className="size-4" /> Chat with Admin
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-neutral-200 px-4 pt-6 text-xs text-neutral-500 sm:flex-row sm:justify-between dark:border-neutral-800">
        <p>© {YEAR} OGEA. All rights reserved.</p>
        <p>
          Created by <span className="font-semibold text-neutral-700 dark:text-neutral-300">{CREATOR_NAME}</span>
        </p>
      </div>
    </footer>
  )
}
