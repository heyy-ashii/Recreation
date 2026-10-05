export { clsx as cn } from 'clsx'

export const CONTACT_EMAIL = 'ogea.sms@gmail.com'
export const CREATOR_NAME = 'Ashique.Pilassery'

export function optimizeImage(url: string | undefined, width = 600): string {
  if (!url) return ''
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/f_auto')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`)
  }
  if (url.includes('images.unsplash.com') && !url.includes('?')) {
    return `${url}?auto=format&fit=crop&q=70&w=${width}`
  }
  return url
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const formatDate = (d?: string | null) => (d ? dateFmt.format(new Date(d)) : '—')

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
export const formatTime = (d: string) => timeFmt.format(new Date(d))

export function daysLeft(deadline?: string) {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
}

export function linkify(text: string) {
  const parts: { type: 'text' | 'email' | 'phone' | 'url'; value: string }[] = []
  const rx = /(https?:\/\/[^\s]+)|([\w.+-]+@[\w-]+\.[\w.-]+)|(\+?\d[\d\s-]{8,}\d)/g
  let last = 0
  for (const m of text.matchAll(rx)) {
    if (m.index! > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: m[1] ? 'url' : m[2] ? 'email' : 'phone', value: m[0] })
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

export const formatShort = (d: string) =>
  new Date(d).toDateString() === new Date().toDateString() ? formatTime(d) : formatDate(d)
