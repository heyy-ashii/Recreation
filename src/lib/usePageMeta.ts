import { useEffect } from 'react'

const DEFAULT_DESC = 'DHGRAM is a simple space for students to share thoughts and message each other, one-to-one.'

export function usePageMeta(title?: string, description = DEFAULT_DESC) {
  useEffect(() => {
    document.title = title ? `${title} | DHGRAM` : 'DHGRAM – Share & Message'
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  }, [title, description])
}
