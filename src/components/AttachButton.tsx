/**
 * AttachButton — the paperclip in the task bar.
 *   no file:  opens the file picker
 *   a file (mobile, where the FileChip is hidden): shows a dot badge, says
 *             "(name attached)" in its label, and opens a small popover to
 *             replace or remove the file
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { CsvData } from '../state/seance.ts'
import s from './TaskInput.module.css'

interface AttachButtonProps {
  file?: CsvData
  disabled?: boolean
  onPick: () => void
  onRemove: () => void
}

const Clip = () => (
  <svg viewBox="0 0 16 16" fill="none" width={16} height={16} aria-hidden="true">
    <path d="M10.5 5 6 9.5a1.4 1.4 0 0 0 2 2L13 6.5a2.8 2.8 0 0 0-4-4L4 7.5a4.2 4.2 0 0 0 6 6l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

export function AttachButton({ file, disabled, onPick, onRemove }: AttachButtonProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // close on a tap outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!file) {
    return (
      <button type="button" className={s.attach} onClick={onPick} disabled={disabled} aria-label="Attach a CSV file">
        <Clip />
        <span className={s.attachLabel}>CSV</span>
      </button>
    )
  }

  const close = () => { setOpen(false); buttonRef.current?.focus() }

  return (
    <span className={s.attachWrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${s.attach} ${s.attached}`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-label={`Attach a CSV file (${file.name} attached)`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Clip />
        <span className={s.badge} aria-hidden="true" data-badge />
      </button>
      {open && (
        <span
          id={menuId}
          className={s.popover}
          role="group"
          aria-label={`${file.name}, ${file.rows} ${file.rows === 1 ? 'row' : 'rows'}`}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
        >
          <span className={s.popoverName}>{file.name} · {file.rows} {file.rows === 1 ? 'row' : 'rows'}</span>
          <button type="button" className={s.popoverBtn} onClick={() => { setOpen(false); onPick() }}>Replace file</button>
          <button type="button" className={s.popoverBtn} onClick={() => { setOpen(false); onRemove() }}>Remove {file.name}</button>
        </span>
      )}
    </span>
  )
}
