/**
 * SegmentedControl — the panel tabs on tablet and mobile (role="tablist").
 * Void track, altar selected pill; 24px tall, 32px and full width on mobile.
 * Arrow keys / Home / End move the selection (roving tabindex).
 */
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import s from './SegmentedControl.module.css'

export interface SegmentOption<T extends string> { value: T; label: string; controls?: string }

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  full?: boolean
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, full }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(0, options.findIndex(o => o.value === value))

  const onKeyDown = (e: KeyboardEvent) => {
    const n = options.length
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: n - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const i = ((next % n) + n) % n
    onChange(options[i].value)
    refs.current[i]?.focus()
  }

  return (
    <div className={`${s.seg} ${full ? s.full : ''}`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el }}
          type="button"
          role="tab"
          aria-selected={i === current}
          aria-controls={o.controls}
          tabIndex={i === current ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
