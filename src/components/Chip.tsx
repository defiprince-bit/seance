/** Chip — 28px suggestion pill on altar. */
import s from './Chip.module.css'

interface ChipProps {
  label: string
  onClick: () => void
}

export function Chip({ label, onClick }: ChipProps) {
  return (
    <button type="button" className={s.chip} onClick={onClick}>{label}</button>
  )
}

export const SUGGESTIONS = [
  'Total the sales in a CSV',
  'Compound interest for 10 years',
  'Sort a list of names',
  'Payroll with overtime',
] as const

/** A row of the four suggestion chips. */
export function SuggestionChips({ onPick }: { onPick: (task: string) => void }) {
  return (
    <div className={s.row} role="group" aria-label="Suggestions">
      {SUGGESTIONS.map(t => <Chip key={t} label={t} onClick={() => onPick(t)} />)}
    </div>
  )
}
