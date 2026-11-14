/**
 * LanguageCard — one role="radio" card in the spirit picker. A resting spirit
 * is shown dashed with a "Resting" tag, aria-disabled, out of the tab order,
 * and ignores clicks.
 */
import type { Ref } from 'react'
import type { Spirit } from '../lib/spirits.ts'
import s from './LanguagePicker.module.css'

interface LanguageCardProps {
  spirit: Spirit
  selected: boolean
  /** roving tabindex: 0 for the selected card, -1 for every other */
  tabIndex: 0 | -1
  onSelect: () => void
  cardRef: Ref<HTMLButtonElement>
}

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="m2.5 6.5 2.2 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export function LanguageCard({ spirit, selected, tabIndex, onSelect, cardRef }: LanguageCardProps) {
  const resting = !spirit.enabled
  const name = `${spirit.name}, born ${spirit.born}, ${spirit.epithet}${resting ? ', resting' : ''}`

  return (
    <button
      ref={cardRef}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={resting || undefined}
      aria-label={name}
      tabIndex={resting ? -1 : tabIndex}
      className={`${s.card} ${resting ? s.rest : ''}`}
      onClick={resting ? undefined : onSelect}
    >
      <span className={s.top}>
        <span className={s.name}>{spirit.name}</span>
        <span className={s.yr}>b. {spirit.born}</span>
      </span>
      <span className={s.ep}>
        <span>{spirit.epithet}</span>
        {selected && <span className={s.sel}><Check />Selected</span>}
        {resting && <span className={s.resting}>Resting</span>}
      </span>
      <span className={s.desc}>{spirit.blurb}</span>
      {!resting && spirit.snippet && <span className={`${s.snippet} crt`}>{spirit.snippet}</span>}
      {!resting && (
        <span className={s.traits}>
          {spirit.traits.map(t => <span key={t}>{t}</span>)}
        </span>
      )}
      {!resting && spirit.dialect && (
        <span className={s.dialect}>
          <span className={s.dialectLabel}>Dialect</span>
          <span className={s.select}>{spirit.dialect}</span>
        </span>
      )}
    </button>
  )
}
