/**
 * TaskInput — 52px task entry plus SummonButton.
 * Ctrl/Cmd+Enter submits; `/` anywhere outside a text field focuses it.
 * (FileChip is task 12, so it is intentionally not rendered yet.)
 */
import { useRef, useEffect } from 'react'
import type { Phase } from '../state/seance.ts'
import { SummonButton } from './SummonButton.tsx'
import type { SummonState } from './SummonButton.tsx'
import s from './TaskInput.module.css'

/** "Edit the task" focuses and selects this input. */
export const TASK_INPUT_ID = 'task-input'

interface TaskInputProps {
  value: string
  phase: Phase
  hasRun: boolean
  onChange: (v: string) => void
  onSubmit: () => void
}

export function TaskInput({ value, phase, hasRun, onChange, onSubmit }: TaskInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = phase === 'summoning' || phase === 'running'
  const empty = value.trim() === '' // Req 1.6
  const remaining = 500 - value.length

  useEffect(() => { inputRef.current?.focus() }, []) // Req 1.1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!empty && !busy) onSubmit()
    }
  }

  const btnState: SummonState = busy ? 'summoning' : hasRun ? 'again' : 'idle'

  return (
    <div className={s.taskbar}>
      <label className={s.task}>
        <svg className={s.arrow} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="#E9A957" strokeWidth="1.5"/>
        </svg>
        <input
          ref={inputRef}
          id={TASK_INPUT_ID}
          className={s.input}
          value={value}
          maxLength={500}
          placeholder="Describe a task in plain English…"
          disabled={busy}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Your task"
        />
        {value.length > 400 && <span className={s.count} aria-live="polite">{remaining} left</span>}
      </label>
      <SummonButton state={btnState} disabled={empty || busy} onClick={onSubmit} />
    </div>
  )
}
