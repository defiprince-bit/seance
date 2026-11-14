/**
 * tests/responsive.test.tsx  (task 13)
 * Breakpoints, the panel SegmentedControl, GhostCaption, the bottom-sheet
 * picker, reduced motion and focus rings. matchMedia is mocked (jsdom has none)
 * and can change width live. Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MOBILE_QUERY, TABLET_QUERY, REDUCED_MOTION_QUERY, visiblePanes, effectiveTab, tabForFailure, layoutFrom } from '../src/lib/layout.ts'
import { Workspace } from '../src/components/Workspace.tsx'
import { TopBar } from '../src/components/TopBar.tsx'
import { goldenFor } from '../src/services/golden.ts'

const SALES = goldenFor('sales')!

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// matchMedia mock: evaluates our three queries against a settable viewport
// ---------------------------------------------------------------------------
const media = { width: 1400, reduced: false }
const listeners = new Set<() => void>()
function evaluate(query: string): boolean {
  if (query === MOBILE_QUERY) return media.width <= 767
  if (query === TABLET_QUERY) return media.width >= 768 && media.width <= 1199
  if (query === REDUCED_MOTION_QUERY) return media.reduced
  return false
}
function installMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return evaluate(query) },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
  }))
}
function setViewport(next: Partial<typeof media>) {
  Object.assign(media, next)
  act(() => { for (const cb of [...listeners]) cb() })
}

let host: HTMLDivElement
let root: Root
function mount(node: React.ReactNode, viewport: Partial<typeof media> = {}) {
  Object.assign(media, { width: 1400, reduced: false }, viewport)
  act(() => root.render(node))
}

beforeEach(() => {
  installMatchMedia()
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo // jsdom lacks it
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
  listeners.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)
const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[role="tablist"] [role="tab"]')]
const tabNamed = (name: string) => tabs().find(t => t.textContent === name)!
const selectedTab = () => tabs().find(t => t.getAttribute('aria-selected') === 'true')?.textContent
const shown = () => ['code', 'ghost', 'python', 'output'].filter(p => !document.getElementById(`panel-${p}`)!.hidden &&
  !document.getElementById(`panel-${p}`)!.closest('[hidden]'))
const click = (el: HTMLElement) => act(() => { el.click() })
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })) })

/** Replays the sales golden séance to the end with fake timers. */
async function replaySales() {
  vi.useFakeTimers()
  click([...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Total the sales in a CSV')!)
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
}

// ---------------------------------------------------------------------------

describe('layout rules (pure)', () => {
  it('maps media matches to a layout', () => {
    expect(layoutFrom({ mobile: false, tablet: false })).toBe('desktop')
    expect(layoutFrom({ mobile: false, tablet: true })).toBe('tablet')
    expect(layoutFrom({ mobile: true, tablet: false })).toBe('mobile')
  })
  it('desktop shows everything and has no tabs', () => {
    expect(effectiveTab('desktop', 'python')).toBeUndefined()
    expect(visiblePanes('desktop', undefined)).toEqual({ code: true, ghost: true, python: true, output: true })
  })
  it('tablet keeps code visible beside one right panel, Ghost by default', () => {
    expect(effectiveTab('tablet')).toBe('ghost')
    expect(effectiveTab('tablet', 'code')).toBe('ghost') // not a tablet tab
    expect(visiblePanes('tablet', 'output')).toEqual({ code: true, ghost: false, python: false, output: true })
  })
  it('mobile shows exactly one panel, Code by default', () => {
    expect(effectiveTab('mobile')).toBe('code')
    for (const t of ['code', 'ghost', 'python', 'output'] as const) {
      expect(Object.values(visiblePanes('mobile', t)).filter(Boolean)).toHaveLength(1)
    }
  })
  it('a failure opens the tab that explains it', () => {
    expect(tabForFailure('python')).toBe('output')
    expect(tabForFailure('run')).toBe('ghost')
    expect(tabForFailure('summon')).toBe('ghost')
  })
})

describe('breakpoint switching (Req 10.1)', () => {
  it('desktop ≥1200: no tabs, all three columns visible', () => {
    mount(<Workspace />, { width: 1400 })
    expect(tabs()).toHaveLength(0)
    expect(shown()).toEqual(['code', 'ghost', 'python', 'output'])
    expect($('main')!.dataset.layout).toBe('desktop')
  })

  it('tablet 768–1199: code plus Ghost / Python / Output tabs, Ghost first', () => {
    mount(<Workspace />, { width: 1024 })
    expect(tabs().map(t => t.textContent)).toEqual(['Ghost', 'Python', 'Output'])
    expect(selectedTab()).toBe('Ghost')
    expect(shown()).toEqual(['code', 'ghost'])
    click(tabNamed('Python'))
    expect(shown()).toEqual(['code', 'python'])
    click(tabNamed('Output'))
    expect(shown()).toEqual(['code', 'output'])
    expect(tabNamed('Output').getAttribute('aria-controls')).toBe('panel-output')
  })

  it('mobile <768: one panel at a time, Code first', () => {
    mount(<Workspace />, { width: 390 })
    expect(tabs().map(t => t.textContent)).toEqual(['Code', 'Ghost', 'Python', 'Output'])
    expect(shown()).toEqual(['code'])
    click(tabNamed('Ghost'))
    expect(shown()).toEqual(['ghost'])
  })

  it('switches live as the window is resized, and back to the exact desktop layout', () => {
    mount(<Workspace />, { width: 1400 })
    setViewport({ width: 1000 })
    expect(selectedTab()).toBe('Ghost')
    setViewport({ width: 500 })
    expect(selectedTab()).toBe('Code')
    setViewport({ width: 1400 })
    expect(tabs()).toHaveLength(0)
    expect(shown()).toEqual(['code', 'ghost', 'python', 'output'])
  })

  it('a failure on mobile opens the tab that explains it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'busy' }), { status: 503 })))
    mount(<Workspace />, { width: 390 })
    const input = document.getElementById('task-input') as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => { setValue.call(input, 'Total sales'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    click($('button[aria-label="Summon"]')!)
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(selectedTab()).toBe('Ghost')
    expect($('#panel-ghost')!.textContent).toContain('The spirits are busy')
  })
})

describe('SegmentedControl', () => {
  it('is a tablist with roving tabindex; arrows, Home and End move and select', () => {
    mount(<Workspace />, { width: 390 })
    expect(tabs().map(t => t.tabIndex)).toEqual([0, -1, -1, -1])
    key(tabNamed('Code'), 'ArrowRight')
    expect(selectedTab()).toBe('Ghost')
    expect(document.activeElement).toBe(tabNamed('Ghost'))
    key(document.activeElement!, 'End')
    expect(selectedTab()).toBe('Output')
    key(document.activeElement!, 'ArrowRight') // wraps
    expect(selectedTab()).toBe('Code')
    key(document.activeElement!, 'ArrowLeft')
    expect(selectedTab()).toBe('Output')
    key(document.activeElement!, 'Home')
    expect(selectedTab()).toBe('Code')
  })
})

describe('GhostCaption (Req 10.2)', () => {
  it('on the mobile Code tab it docks the current ghost step, with prev / next', async () => {
    mount(<Workspace />, { width: 390 })
    await replaySales()
    const caption = () => $('aside[aria-label="The ghost\'s current explanation"]')
    const ref = (i: number) => { const [a, b] = SALES.narration.steps[i].range; return a === b ? `LINE ${a}` : `LINES ${a}–${b}` }
    expect(caption()!.textContent).toContain(ref(0))
    expect(caption()!.textContent).toContain(SALES.narration.steps[0].text)
    click(caption()!.querySelector<HTMLButtonElement>('button[aria-label="Next explanation"]')!)
    expect(caption()!.textContent).toContain(ref(1))
    click(tabNamed('Ghost'))
    expect(caption()).toBeNull()
  })

  it('is never shown on tablet or desktop', async () => {
    mount(<Workspace />, { width: 1024 })
    await replaySales()
    expect($('aside')).toBeNull()
    setViewport({ width: 1400 })
    expect($('aside')).toBeNull()
  })
})

describe('bottom-sheet picker under 768px', () => {
  const renderTop = () => mount(
    <TopBar sessionTitle="" status={{ tone: 'idle', label: 'Candles lit' }} onEnd={() => {}} onSpiritConfirm={() => {}} />,
    { width: 390 },
  )
  const trigger = () => $<HTMLButtonElement>('button[aria-haspopup="dialog"]')!

  it('opens as a sheet with the same dialog semantics; unselected cards are compact', () => {
    renderTop()
    click(trigger())
    const dialog = $('[role="dialog"]')!
    expect(dialog.dataset.variant).toBe('sheet')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const [cobol, ...others] = [...document.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(cobol.dataset.compact).toBeUndefined()
    expect(cobol.querySelector('[data-snippet]')).not.toBeNull()
    for (const card of others) {
      expect(card.dataset.compact).toBeDefined()
      expect(card.querySelector('[data-snippet]')).toBeNull()
    }
  })

  it('keeps the focus trap', () => {
    renderTop()
    click(trigger())
    const close = $<HTMLButtonElement>('button[aria-label="Close"]')!
    const summon = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent?.startsWith('Summon with'))!
    summon.focus()
    key(summon, 'Tab')
    expect(document.activeElement).toBe(close)
    key(close, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(summon)
  })

  it('Esc closes it and returns focus to the trigger', () => {
    renderTop()
    click(trigger())
    key(document.activeElement!, 'Escape')
    expect($('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('is a centred dialog again at desktop width', () => {
    renderTop()
    setViewport({ width: 1400 })
    click(trigger())
    expect($('[role="dialog"]')!.dataset.variant).toBe('dialog')
    expect(document.querySelector('[data-compact]')).toBeNull()
  })
})

describe('reduced motion (Req 10.3)', () => {
  const linesOf = () => [...document.querySelectorAll<HTMLElement>('#panel-code [data-n]')]

  it('full motion: lines stream in with a 40ms stagger and the planchette glides', async () => {
    mount(<Workspace />, { reduced: false })
    await replaySales()
    expect($('section[aria-label="COBOL program"]')!.dataset.motion).toBe('full')
    expect(linesOf()[1].style.animationDelay).toBe('40ms')
    expect($('[data-planchette]')!.style.transition).toBe('')
  })

  it('reduced: every line shows at once and the planchette jumps; same content and final state', async () => {
    mount(<Workspace />, { reduced: true })
    await replaySales()
    expect($('section[aria-label="COBOL program"]')!.dataset.motion).toBe('reduced')
    expect(linesOf().every(l => l.style.animationDelay === '')).toBe(true)
    expect($('[data-planchette]')!.style.transition).toBe('none')
    expect(linesOf()).toHaveLength(SALES.program.lines.length)
    expect(document.body.textContent).toContain('Python agrees.')
  })

  it('reduced: no typing caret while narration plays', async () => {
    mount(<Workspace />, { reduced: true })
    await replaySales()
    click($('button[aria-label="Play narration"]')!)
    expect(document.querySelector('[data-speaking]')).toBeNull()
    setViewport({ reduced: false })
    expect(document.querySelector('[data-speaking]')).not.toBeNull()
  })
})

describe('focus rings (Req 10.4)', () => {
  const css = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const modules = readdirSync(join(process.cwd(), 'src/components')).filter(f => f.endsWith('.module.css'))

  it('every focusable element gets the --ring token on :focus-visible', () => {
    expect(css('src/styles/motion.css')).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--ring\)/)
  })

  it('no module removes the ring, except the task input whose box glows on focus-within', () => {
    const offenders: string[] = []
    for (const file of modules) {
      for (const m of css(`src/components/${file}`).matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)) {
        if (/box-shadow:\s*none|outline:\s*(none|0)/.test(m[2])) offenders.push(`${file}: ${m[1].trim()}`)
      }
    }
    expect(offenders).toEqual(['TaskInput.module.css: .input:focus-visible'])
    expect(css('src/components/TaskInput.module.css')).toMatch(/\.task:focus-within\s*\{[^}]*box-shadow:\s*var\(--glow-candle\)/)
  })

  it("the selected spirit card keeps the ring alongside its glow", () => {
    expect(css('src/components/LanguagePicker.module.css')).toMatch(/\.card\[aria-checked="true"\]:focus-visible\s*\{\s*box-shadow:\s*var\(--ring\),\s*var\(--glow-candle\)/)
  })
})
