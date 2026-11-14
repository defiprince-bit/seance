/**
 * LanguageTrigger — "Spirit COBOL ▾" in the top bar. Opens the LanguagePicker
 * in a portal on document.body: the top bar uses backdrop-filter, which would
 * otherwise trap the fixed-position dialog inside the bar. Closing the picker
 * (Esc, Cancel, close, scrim, or confirm) puts focus back on this button.
 */
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SPIRITS } from '../lib/spirits.ts'
import { LanguagePicker } from './LanguagePicker.tsx'
import s from './LanguageTrigger.module.css'

interface LanguageTriggerProps {
  /** id of the spirit in use (always 'cobol' for the MVP) */
  value?: string
  /** "Summon with {lang}" was pressed; focus is already back on the trigger */
  onConfirm: (id: string) => void
}

export function LanguageTrigger({ value = 'cobol', onConfirm }: LanguageTriggerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const current = SPIRITS.find(sp => sp.id === value) ?? SPIRITS[0]

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={s.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={s.label}>Spirit</span>
        <b className={s.name}>{current.name}</b>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && createPortal(
        <LanguagePicker
          value={current.id}
          onCancel={close}
          onConfirm={id => { close(); onConfirm(id) }}
        />,
        document.body,
      )}
    </>
  )
}
