import { useEffect, type ReactNode } from 'react'
import { SITE_CONTENT } from '../data/loadSiteContent'
import { ContentContext } from './contentContext'

/** Resolve a CMS path/URL against siteUrl when the path is relative. */
function absoluteUrl(siteUrl: string, path: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path
  const origin = siteUrl.replace(/\/$/, '')
  if (!origin) return path
  return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`
}

function setMeta(
  selector: string,
  attr: 'content' | 'href',
  value: string,
  create?: { tag: 'meta' | 'link'; attrs: Record<string, string> },
) {
  let el = document.querySelector(selector) as HTMLElement | null
  if (!el && create && value) {
    el = document.createElement(create.tag)
    for (const [k, v] of Object.entries(create.attrs)) {
      el.setAttribute(k, v)
    }
    document.head.appendChild(el)
  }
  if (!el) return
  if (!value) {
    el.remove()
    return
  }
  el.setAttribute(attr, value)
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const content = SITE_CONTENT

  useEffect(() => {
    const {
      pageTitle,
      pageDescription,
      siteUrl,
      favicon,
      ogImage,
    } = content.siteSettings

    document.title = pageTitle

    setMeta('meta[name="description"]', 'content', pageDescription, {
      tag: 'meta',
      attrs: { name: 'description' },
    })
    setMeta('meta[property="og:title"]', 'content', pageTitle, {
      tag: 'meta',
      attrs: { property: 'og:title' },
    })
    setMeta('meta[property="og:description"]', 'content', pageDescription, {
      tag: 'meta',
      attrs: { property: 'og:description' },
    })
    setMeta('meta[name="twitter:title"]', 'content', pageTitle, {
      tag: 'meta',
      attrs: { name: 'twitter:title' },
    })
    setMeta('meta[name="twitter:description"]', 'content', pageDescription, {
      tag: 'meta',
      attrs: { name: 'twitter:description' },
    })

    const fav = favicon || '/favicon.svg'
    setMeta('link[rel="icon"]', 'href', fav, {
      tag: 'link',
      attrs: { rel: 'icon' },
    })

    const ogAbs = absoluteUrl(siteUrl, ogImage)
    setMeta('meta[property="og:image"]', 'content', ogAbs, {
      tag: 'meta',
      attrs: { property: 'og:image' },
    })
    setMeta('meta[name="twitter:image"]', 'content', ogAbs, {
      tag: 'meta',
      attrs: { name: 'twitter:image' },
    })
    if (ogAbs) {
      setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image', {
        tag: 'meta',
        attrs: { name: 'twitter:card' },
      })
    }

    if (siteUrl) {
      setMeta('meta[property="og:url"]', 'content', siteUrl.replace(/\/$/, ''), {
        tag: 'meta',
        attrs: { property: 'og:url' },
      })
    }
  }, [content])

  return (
    <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
  )
}
