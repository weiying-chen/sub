export type WatchProfile = {
  type: 'subs' | 'news' | 'dramas' | 'docs' | 'text'
  reporter: 'subs' | 'news'
  label: string
  maxChars?: number
  supportsBaseline: boolean
}

const WATCH_PROFILES: Record<WatchProfile['type'], WatchProfile> = {
  subs: {
    type: 'subs',
    reporter: 'subs',
    label: '(subs)',
    maxChars: undefined,
    supportsBaseline: true,
  },
  news: {
    type: 'news',
    reporter: 'news',
    label: '(news)',
    maxChars: undefined,
    supportsBaseline: false,
  },
  dramas: {
    type: 'dramas',
    reporter: 'subs',
    label: '(dramas)',
    maxChars: 50,
    supportsBaseline: true,
  },
  docs: {
    type: 'docs',
    reporter: 'subs',
    label: '(docs)',
    maxChars: undefined,
    supportsBaseline: true,
  },
  text: {
    type: 'text',
    reporter: 'subs',
    label: '(text)',
    maxChars: undefined,
    supportsBaseline: false,
  },
}

export function resolveWatchProfile(type: string): WatchProfile | null {
  const normalizedType = type.trim().toLowerCase() as WatchProfile['type']
  return WATCH_PROFILES[normalizedType] ?? null
}
