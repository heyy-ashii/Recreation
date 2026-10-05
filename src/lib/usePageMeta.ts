import { useEffect } from 'react'

const DEFAULT_DESC =
  'OGEA curates quizzes, workshops, writing competitions, seminars, hackathons and conferences for students across Kerala.'

export function usePageMeta(title?: string, description = DEFAULT_DESC) {
  useEffect(() => {
    document.title = title ? `${title} | OGEA` : 'OGEA – Opportunities Beyond Campus'
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  }, [title, description])
}
