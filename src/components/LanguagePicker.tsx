/**
 * LanguagePicker — the "Who should answer?" dialog (Req 9, design/mocks/picker.html).
 * role="dialog" aria-modal with a LanguageCard radiogroup. Focus is trapped
 * inside; arrow keys move the selection with a roving tabindex, skipping
 * resting spirits; Esc, Cancel, the close button and the scrim all cancel.
 * Every keydown stops here, so the workspace shortcuts (Esc abort, j/k, /)
 * never fire behind the dialog. Under 768px it is a bottom sheet (variant 'sheet')
 * with the same semantics; unselected cards there use the compact layout.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { SPIRITS, initialIndex, nextEnabledIndex } from '../lib/spirits.ts'
import type { Spirit } from '../lib/spirits.ts'
import { LanguageCard } from './LanguageCard.tsx'
import s from './LanguagePicker.module.css'

interface LanguagePickerProps {
  /** id of the spirit currently in use */
  value: string
  spirits?: readonly Spirit[]
  onConfirm: (id: string) => void
  onCancel: () => void
  /** 'sheet' = mobile bottom sheet; same dialog semantics and keyboard */
  variant?: 'dialog' | 'sheet'
}

const STEP: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function LanguagePicker({ value, spirits = SPIRITS, onConfirm, onCancel, variant = 'dialog' }: LanguagePickerProps) {
  const sheet = variant === 'sheet'
  const [selected, setSelected] = useState(() => initialIndex(spirits, value))
  const dialogRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  // open with focus on the selected card
  useEffect(() => { cardRefs.current[selected]?.focus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (i: number, focus: boolean) => {
    if (!spirits[i]?.enabled) return
    setSelected(i)
    if (focus) cardRefs.current[i]?.focus()
  }

  const trapTab = (e: KeyboardEvent) => {
    const nodes = [...(dialogRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])]
      .filter(n => n.tabIndex !== -1)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement
    const inside = dialogRef.current?.contains(active)
    if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus() }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
    if (e.key === 'Tab') { trapTab(e); return }
    const step = STEP[e.key]
    if (step && (e.target as HTMLElement).getAttribute('role') === 'radio') {
      e.preventDefault()
      select(nextEnabledIndex(spirits, selected, step), true)
    }
  }

  const chosen = spirits[selected]

  return (
    <>
      <div className={s.scrim} onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={`${s.dialog} ${sheet ? s.sheet : ''}`}
        data-variant={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spirit-picker-title"
        onKeyDown={onKeyDown}
      >
        {sheet && <div className={s.handle} aria-hidden="true" />}
        <div className={s.dh}>
          <div>
            <span className={s.eyebrow}>Choose a spirit</span>
            <h2 id="spirit-picker-title" className={s.title}>Who should <em>answer?</em></h2>
            <p className={s.lede}>Pick the language the ghost writes in. Fortran and BASIC are resting for now.</p>
          </div>
          <button type="button" className={s.close} onClick={onCancel} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={s.cards} role="radiogroup" aria-labelledby="spirit-picker-title">
          {spirits.map((spirit, i) => (
            <LanguageCard
              key={spirit.id}
              spirit={spirit}
              selected={i === selected}
              tabIndex={i === selected ? 0 : -1}
              compact={sheet && i !== selected}
              onSelect={() => select(i, false)}
              cardRef={el => { cardRefs.current[i] = el }}
            />
          ))}
        </div>

        <div className={s.df}>
          <span className={s.foot}>Not sure? Start with COBOL. ALGOL, Pascal and friends are still resting.</span>
          <button type="button" className={s.btn} onClick={onCancel}>Cancel</button>
          <button type="button" className={`${s.btn} ${s.candle}`} onClick={() => onConfirm(chosen.id)}>
            Summon with {chosen.name}
          </button>
        </div>
      </div>
    </>
  )
}
