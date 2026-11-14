/**
 * tests/landing.test.tsx  (task 14)
 * Routing (/ is the landing, /seance the workspace), every "Begin a séance"
 * CTA, the exact footnote, honest copy, the reduced-motion hero and the Vercel
 * rewrite. Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { REDUCED_MOTION_QUERY } from '../src/lib/layout.ts'
import { FOOTNOTE, isWorkspacePath } from '../src/lib/copy.ts'
import App from '../src/App.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let reduced = false
function installMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return query === REDUCED_MOTION_QUERY ? reduced : false },
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
  }))
}

let host: HTMLDivElement
let root: Root
function visit(path: string) {
  window.history.pushState({}, '', path)
  act(() => root.render(<App />))
}

beforeEach(() => {
  reduced = false
  installMatchMedia()
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  window.history.pushState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('routing (Req 11.1)', () => {
  it('/ shows the landing, not the workspace', () => {
    visit('/')
    expect(host.querySelector('[data-page="landing"]')).not.toBeNull()
    expect(host.querySelector('h1')?.textContent).toContain('1959')
    expect(host.querySelector('#task-input')).toBeNull()
  })

  it('/seance shows the workspace in its empty state', () => {
    visit('/seance')
    expect(host.querySelector('[data-page="landing"]')).toBeNull()
    expect(host.querySelector('#task-input')).not.toBeNull()
    expect(host.textContent).toContain('The candles are lit.')
  })

  it('treats /seance/ and nested paths as the workspace, other paths as the landing', () => {
    expect(isWorkspacePath('/seance')).toBe(true)
    expect(isWorkspacePath('/seance/')).toBe(true)
    expect(isWorkspacePath('/seance/x')).toBe(true)
    expect(isWorkspacePath('/')).toBe(false)
    expect(isWorkspacePath('/seancex')).toBe(false)
    expect(isWorkspacePath('/api/run')).toBe(false)
  })

  it('Vercel rewrites /seance to the SPA without catching /api or assets', () => {
    const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] }
    const sources = cfg.rewrites.map(r => r.source)
    expect(sources).toContain('/seance')
    expect(sources).toContain('/seance/:path*')
    for (const r of cfg.rewrites) {
      expect(r.destination).toBe('/index.html')
      expect(r.source.startsWith('/seance')).toBe(true)
    }
  })
})

describe('"Begin a séance" CTAs (Req 11.2)', () => {
  it('every Begin a séance link goes to /seance', () => {
    visit('/')
    const ctas = [...host.querySelectorAll<HTMLAnchorElement>('a')].filter(
      a => a.textContent?.includes('Begin a séance') || a.getAttribute('aria-label') === 'Begin a séance',
    )
    expect(ctas.length).toBeGreaterThanOrEqual(3) // nav round button, hero pill, final pill
    for (const a of ctas) expect(a.getAttribute('href')).toBe('/seance')
    for (const a of host.querySelectorAll('[data-cta="begin"]')) expect(a.getAttribute('href')).toBe('/seance')
  })

  it('only the enabled spirit (COBOL) links anywhere', () => {
    visit('/')
    expect(host.querySelector('a[data-spirit="cobol"]')?.getAttribute('href')).toBe('/seance')
    expect(host.querySelector('a[data-spirit="fortran"]')).toBeNull()
    expect(host.querySelector('a[data-spirit="basic"]')).toBeNull()
    expect(host.querySelector('[data-spirit="fortran"]')?.textContent).toContain('Resting')
  })
})

describe('copy (Req 11.3, 11.4)', () => {
  it('shows the footnote word for word', () => {
    visit('/')
    expect(FOOTNOTE).toBe('Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production.')
    const notes = [...host.querySelectorAll('[data-footnote]')].map(n => n.textContent)
    expect(notes.length).toBeGreaterThan(0)
    for (const n of notes) expect(n).toBe(FOOTNOTE)
  })

  it('makes no claims the app cannot back up', () => {
    visit('/')
    const text = host.textContent ?? ''
    expect(text).not.toMatch(/COBOL, Fortran or BASIC/)
    expect(text).not.toMatch(/retiring/i)
    expect(text).not.toMatch(/mid-séance|switch/i)
    expect(text).not.toMatch(/takes about a minute/i)
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(%|percent|users|developers|million|billion)\b/i)
    expect(text).not.toMatch(/trusted by|ouija|spooky|haunted|\bboo\b/i)
    expect(text).not.toMatch(/whole thing runs in your browser|runs entirely in your browser/i)
  })
})

describe('hero motion (reduced motion)', () => {
  it('animates the hero object when motion is allowed', () => {
    visit('/')
    const hero = host.querySelector('img[data-hero]')!
    expect(hero.getAttribute('alt')).toMatch(/terminal/)
    expect(hero.getAttribute('data-anim')).toBe('float')
    expect(host.querySelector('[data-page="landing"]')?.getAttribute('data-motion')).toBe('full')
  })

  it('stops float/tilt, glow, webs, spider and props under prefers-reduced-motion', () => {
    reduced = true
    visit('/')
    expect(host.querySelector('[data-page="landing"]')?.getAttribute('data-motion')).toBe('reduced')
    expect(host.querySelector('section[data-motion]')?.getAttribute('data-motion')).toBe('reduced')
    expect(host.querySelector('img[data-hero]')?.hasAttribute('data-anim')).toBe(false)
    expect(host.querySelectorAll('[data-anim]').length).toBe(0)
  })

  it('keeps every landing animation behind the data-anim switch in CSS', () => {
    const css = readFileSync('src/components/Landing.module.css', 'utf8')
    const rules = css.split('}').filter(r => /animation\s*:\s*(?!none)/.test(r))
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) expect(r).toMatch(/\[data-anim\]/)
  })
})
