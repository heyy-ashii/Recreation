import { Code2, LogOut, Mail, MessageCircle, MessageSquare, Timer, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import AuthPanel from '../components/AuthPanel'
import BrandName from '../components/BrandName'
import { useAuth } from '../context/AuthContext'
import { useUi } from '../context/UiContext'
import { usePageMeta } from '../lib/usePageMeta'
import { CONTACT_EMAIL, CREATOR_NAME } from '../lib/utils'

const credits = [{ name: CREATOR_NAME, role: 'Founder · Design & Full-stack Development', icon: Code2 }]

const steps = [
  { icon: MessageSquare, title: 'Share thoughts', text: 'Any signed-in student can post a thought to the public feed.' },
  { icon: Users, title: 'Chat with anyone', text: 'Open Messages to find every student and start a conversation.' },
  { icon: Timer, title: 'Stays fresh', text: 'Messages clear automatically after 30 days, so nothing piles up.' },
]

export default function About() {
  usePageMeta('About', `About DHGRAM — created by ${CREATOR_NAME}.`)
  const { user, logout } = useAuth()
  const { setChatOpen, toast } = useUi()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          About <BrandName /> — <span className="text-brand">Share & connect.</span>
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          <BrandName /> is a simple space for students to share thoughts and message each other, one-to-one.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Credits</h2>
        <p className="text-sm text-neutral-500">The person behind everything we build.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {credits.map((c) => (
            <div key={c.name} className="card flex items-center gap-4 p-5">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
                {c.name[0]}
              </span>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-neutral-500">{c.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">How <BrandName /> Works</h2>
        <p className="text-sm text-neutral-500">Simple. Reliable. Student focused.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title} className="card p-6">
              <s.icon className="size-7 text-brand" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid items-start gap-8 lg:grid-cols-2" id="account">
        <div>
          <h2 className="text-2xl font-bold">Need help or have feedback?</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Send us an email or chat with the admin team and we will get back to you.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className="btn-outline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('DHGRAM feedback')}`}>
              <Mail className="size-4" /> Email us
            </a>
            <button className="btn-primary" onClick={() => setChatOpen(true)}>
              <MessageCircle className="size-4" /> Chat with Admin
            </button>
          </div>
        </div>
        {user ? (
          <div className="card p-6">
            <p className="text-sm text-neutral-500">Signed in as</p>
            <p className="text-lg font-semibold">{user.name} <span className="text-sm font-normal text-neutral-500">@{user.username}</span></p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/account" className="btn-outline">My account</Link>
              {user.role === 'admin' && <Link to="/admin" className="btn-dark">Admin dashboard</Link>}
              <button
                className="btn-ghost"
                onClick={async () => {
                  await logout()
                  toast('Logged out')
                }}
              >
                <LogOut className="size-4" /> Logout
              </button>
            </div>
          </div>
        ) : (
          <AuthPanel />
        )}
      </section>
    </div>
  )
}
