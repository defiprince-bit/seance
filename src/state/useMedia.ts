/**
 * src/state/useMedia.ts
 * matchMedia as React state (useSyncExternalStore), updating live on resize
 * or a reduced-motion change. Where matchMedia is missing (old jsdom, SSR),
 * every query is false: desktop layout, full motion.
 */
import { useSyncExternalStore } from 'react'
import { MOBILE_QUERY, TABLET_QUERY, REDUCED_MOTION_QUERY, layoutFrom } from '../lib/layout.ts'
import type { Layout } from '../lib/layout.ts'

function mediaList(query: string): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
  return window.matchMedia(query)
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const mql = mediaList(query)
      if (!mql) return () => {}
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
      }
      mql.addListener(onChange) // Safari < 14
      return () => mql.removeListener(onChange)
    },
    () => mediaList(query)?.matches ?? false,
    () => false,
  )
}

export function useLayout(): Layout {
  const mobile = useMediaQuery(MOBILE_QUERY)
  const tablet = useMediaQuery(TABLET_QUERY)
  return layoutFrom({ mobile, tablet })
}

export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
