/**
 * tests/languagePicker.test.tsx  (task 11)
 * The spirit picker: opens from the top-bar trigger, resting spirits can't be
 * picked, arrow keys rove (skipping resting cards), Esc / Cancel / close
 * return focus to the trigger, Tab is trapped, and workspace shortcuts never
 * fire behind the dialog. Validates: Requirements 9.1, 9.2, 9.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { TopBar } from '../src/components/TopBar.tsx'
import { LanguagePicker } from '../src/components/LanguagePicker.tsx'
import { SPIRITS, nextEnabledIndex, initialIndex } from '../src/lib/spirits.ts'
import type { Spirit } from '../src/lib/spirits.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
})

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T & HTMLElement>(sel)
const qa = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
const dialog = () => q('[role="dialog"]')
const radios = () => qa('[role="radio"]')
const trigger = () => q<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
const byText = (text: string) => qa('button').find(b => b.textContent?.trim() === text)!
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })) })
const click = (el: HTMLElement) => act(() => { el.click() })

function renderTopBar(onSpiritConfirm = vi.fn()) {
  act(() => root.render(<TopBar sessionTitle="" status={{ tone: 'idle', label: 'Candles lit' }} onEnd={() => {}} onSpiritConfirm={onSpiritConfirm} />))
  return onSpiritConfirm
}

function openPicker() {
  renderTopBar()
  click(trigger())
}

describe('trigger and dialog (Req 9.1)', () => {
  it('the trigger is a real "Spirit COBOL" button that announces a dialog', () => {
    renderTopBar()
    const t = trigger()
    expect(t.tagName).toBe('BUTTON')
    expect(t.textContent).toContain('Spirit')
    expect(t.textContent).toContain('COBOL')
    expect(t.getAttribute('aria-expanded')).toBe('false')
    expect(dialog()).toBeNull()
  })

  it('opens a modal dialog titled "Who should answer?" with three cards in a radiogroup', () => {
    openPicker()
    const d = dialog()!
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent).toBe('Who should answer?')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(q('[role="radiogroup"]')!.contains(radios()[0])).toBe(true)
    expect(radios().map(r => r.getAttribute('aria-label'))).toEqual([
      'COBOL, born 1959, The ledger keeper',
      'Fortran, born 1957, The calculator, resting',
      'BASIC, born 1964, The first teacher, resting',
    ])
  })

  it('renders outside the top bar so position: fixed is not trapped by its backdrop-filter', () => {
    openPicker()
    expect(q('header')!.contains(dialog())).toBe(false)
  })

  it('opens with COBOL selected and focused, and a "Summon with COBOL" button', () => {
    openPicker()
    const [cobol] = radios()
    expect(cobol.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(cobol)
    expect(byText('Summon with COBOL')).toBeTruthy()
  })
})

describe('resting spirits (Req 9.2)', () => {
  it('Fortran and BASIC say "Resting", are aria-disabled and out of the tab order', () => {
    openPicker()
    for (const card of radios().slice(1)) {
      expect(card.textContent).toContain('Resting')
      expect(card.getAttribute('aria-disabled')).toBe('true')
      expect(card.tabIndex).toBe(-1)
    }
    expect(radios()[0].getAttribute('aria-disabled')).toBeNull()
  })

  it('clicking a resting card never selects it', () => {
    openPicker()
    click(radios()[1])
    click(radios()[2])
    expect(radios().map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(byText('Summon with COBOL')).toBeTruthy()
  })

  it('every arrow key keeps the selection on COBOL (the only enabled spirit)', () => {
    openPicker()
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      key(document.activeElement!, k)
      expect(radios()[0].getAttribute('aria-checked')).toBe('true')
      expect(document.activeElement).toBe(radios()[0])
    }
  })
})

describe('keyboard (Req 9.3)', () => {
  const custom: Spirit[] = [
    { ...SPIRITS[0], id: 'a', name: 'Alpha', enabled: true },
    { ...SPIRITS[1], id: 'b', name: 'Beta', enabled: false },
    { ...SPIRITS[0], id: 'c', name: 'Gamma', enabled: true },
  ]

  it('arrow keys rove the selection and tabindex, skipping resting cards and wrapping', () => {
    act(() => root.render(<LanguagePicker value="a" spirits={custom} onConfirm={() => {}} onCancel={() => {}} />))
    const state = () => radios().map(r => `${r.getAttribute('aria-checked')}/${r.tabIndex}`)
    key(radios()[0], 'ArrowRight')
    expect(state()).toEqual(['false/-1', 'false/-1', 'true/0'])
    expect(document.activeElement).toBe(radios()[2])
    expect(byText('Summon with Gamma')).toBeTruthy()
    key(radios()[2], 'ArrowDown') // wraps past the resting Beta
    expect(state()).toEqual(['true/0', 'false/-1', 'false/-1'])
    key(radios()[0], 'ArrowLeft')
    expect(document.activeElement).toBe(radios()[2])
  })

  it('Esc closes and returns focus to the trigger, without confirming', () => {
    const onSpiritConfirm = renderTopBar()
    click(trigger())
    key(document.activeElement!, 'Escape')
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(onSpiritConfirm).not.toHaveBeenCalled()
  })

  it.each(['Cancel', 'Close'])('%s closes and returns focus to the trigger', label => {
    openPicker()
    click(label === 'Close' ? q<HTMLButtonElement>('button[aria-label="Close"]')! : byText('Cancel'))
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('"Summon with COBOL" confirms cobol, closes, and returns focus to the trigger', () => {
    const onSpiritConfirm = renderTopBar()
    click(trigger())
    click(byText('Summon with COBOL'))
    expect(onSpiritConfirm).toHaveBeenCalledWith('cobol')
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('Tab and Shift+Tab are trapped inside the dialog', () => {
    openPicker()
    const close = q<HTMLButtonElement>('button[aria-label="Close"]')!
    const summon = byText('Summon with COBOL')
    summon.focus()
    key(summon, 'Tab')
    expect(document.activeElement).toBe(close)
    key(close, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(summon)
  })

  it('keys pressed in the dialog never reach the workspace shortcuts (Esc abort, j/k, /)', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    openPicker()
    for (const k of ['j', 'k', '/', 'ArrowRight', 'Escape']) key(document.activeElement ?? document.body, k)
    window.removeEventListener('keydown', onWindowKey)
    expect(onWindowKey).not.toHaveBeenCalled()
  })
})

describe('spirits rules', () => {
  it('COBOL is the only enabled spirit', () => {
    expect(SPIRITS.filter(s => s.enabled).map(s => s.id)).toEqual(['cobol'])
  })
  it('initialIndex never lands on a resting spirit', () => {
    expect(initialIndex(SPIRITS, 'fortran')).toBe(0)
    expect(initialIndex(SPIRITS, 'nope')).toBe(0)
  })
  it('nextEnabledIndex stays put when nothing else is enabled', () => {
    expect(nextEnabledIndex(SPIRITS, 0, 1)).toBe(0)
    expect(nextEnabledIndex(SPIRITS, 0, -1)).toBe(0)
  })
})
