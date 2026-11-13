/** Chip — 28px suggestion pill on altar. */
import { CHIP_LABELS } from '../lib/golden.ts'
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

/** The four chip labels (Req 2.1), from the one list the golden séances use. */
export const SUGGESTIONS = CHIP_LABELS

/** A row of the four suggestion chips. */
export function SuggestionChips({ onPick }: { onPick: (task: string) => void }) {
  return (
    <div className={s.row} role="group" aria-label="Suggestions">
      {SUGGESTIONS.map(t => <Chip key={t} label={t} onClick={() => onPick(t)} />)}
    </div>
  )
}
