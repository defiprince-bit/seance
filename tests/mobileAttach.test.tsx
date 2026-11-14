/**
 * tests/mobileAttach.test.tsx
 * On mobile the FileChip is hidden, so the paperclip shows that a CSV is
 * attached (badge + label) and lets you replace or remove it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MOBILE_QUERY } from '../src/lib/layout.ts'
import { Workspace } from '../src/components/Workspace.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SALES = 'region,amount\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n'
let width = 390
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    media: q,
    get matches() { return q === MOBILE_QUERY ? width <= 767 : q.includes('min-width: 768px') ? width >= 768 && width <= 1199 : false },
    addEventListener: () => {}, removeEventListener: () => {},
  }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const clip = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Attach a CSV file"]')
const popover = () => document.querySelector('[role="group"][aria-label^="sales.csv"]')
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!
const byText = (t: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === t)
const click = (el: HTMLElement) => act(() => { el.click() })

async function attach(text = SALES) {
  Object.defineProperty(fileInput(), 'files', { value: [new File([text], 'sales.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => { fileInput().dispatchEvent(new Event('change', { bubbles: true })) })
  const t0 = Date.now()
  while (!clip()?.getAttribute('aria-label')?.includes('attached') && !document.querySelector('button[aria-label="Remove sales.csv"]')) {
    if (Date.now() - t0 > 2000) throw new Error('file was not attached')
    await act(async () => { await new Promise(r => setTimeout(r, 5)) })
  }
}

describe('mobile attach indicator', () => {
  it('shows a badge and says the file is attached, instead of the hidden FileChip', async () => {
    width = 390
    act(() => root.render(<Workspace />))
    expect(clip()!.getAttribute('aria-label')).toBe('Attach a CSV file')
    expect(document.querySelector('[data-badge]')).toBeNull()
    await attach()
    expect(clip()!.getAttribute('aria-label')).toBe('Attach a CSV file (sales.csv attached)')
    expect(document.querySelector('[data-badge]')).not.toBeNull()
    expect(document.querySelector('button[aria-label="Remove sales.csv"]')).toBeNull() // no FileChip
  })

  it('tapping it offers Replace and Remove; Remove clears the file', async () => {
    width = 390
    act(() => root.render(<Workspace />))
    await attach()
    click(clip()!)
    expect(clip()!.getAttribute('aria-expanded')).toBe('true')
    expect(popover()!.getAttribute('aria-label')).toBe('sales.csv, 4 rows')
    click(byText('Remove sales.csv')!)
    expect(clip()!.getAttribute('aria-label')).toBe('Attach a CSV file')
    expect(document.querySelector('[data-badge]')).toBeNull()
  })

  it('Replace opens the file picker again; Esc closes the popover', async () => {
    width = 390
    act(() => root.render(<Workspace />))
    await attach()
    const pick = vi.spyOn(fileInput(), 'click')
    click(clip()!)
    click(byText('Replace file')!)
    expect(pick).toHaveBeenCalledTimes(1)
    expect(popover()).toBeNull()
    click(clip()!)
    act(() => { byText('Replace file')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(clip())
  })

  it('desktop still shows the FileChip', async () => {
    width = 1400
    act(() => root.render(<Workspace />))
    await attach()
    expect(document.querySelector('button[aria-label="Remove sales.csv"]')).not.toBeNull()
    expect(document.querySelector('[data-badge]')).toBeNull()
  })
})
