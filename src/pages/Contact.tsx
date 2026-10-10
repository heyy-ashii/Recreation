import { Mail, MessageCircle } from 'lucide-react'
import { useUi } from '../context/UiContext'
import { usePageMeta } from '../lib/usePageMeta'
import { CONTACT_EMAIL } from '../lib/utils'

export default function Contact() {
  usePageMeta('Contact', `Contact OGEA at ${CONTACT_EMAIL} or chat with the admin.`)
  const { setChatOpen } = useUi()
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">Contact Us</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">Questions, feedback, or something not working? We&apos;d love to hear from you.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${CONTACT_EMAIL}`} className="card p-6 text-left transition hover:border-brand">
          <Mail className="size-7 text-brand" />
          <p className="mt-3 font-semibold">Email</p>
          <p className="text-sm text-neutral-500">{CONTACT_EMAIL}</p>
        </a>
        <button onClick={() => setChatOpen(true)} className="card p-6 text-left transition hover:border-brand">
          <MessageCircle className="size-7 text-brand" />
          <p className="mt-3 font-semibold">Chat with Admin</p>
          <p className="text-sm text-neutral-500">Message the admin team directly from the site.</p>
        </button>
      </div>
    </div>
  )
}
