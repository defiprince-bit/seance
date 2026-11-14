/**
 * FeatureChips: outline pills. Only COBOL is live, so Fortran and BASIC are
 * labelled as resting rather than offered.
 */
import s from './Landing.module.css'

const CHIPS: { label: string; resting?: boolean }[] = [
  { label: 'COBOL' },
  { label: 'Line-by-line ghost' },
  { label: 'Back to Python' },
  { label: 'Real GnuCOBOL compiler' },
  { label: 'Fortran · resting', resting: true },
  { label: 'BASIC · resting', resting: true },
]

export function FeatureChips({ mobile = false }: { mobile?: boolean }) {
  return (
    <ul className={`${s.chips} ${mobile ? s.mobileOnly : ''}`} aria-label="Features">
      {CHIPS.map(c => (
        <li key={c.label} className={c.resting ? s.resting : undefined}>{c.label}</li>
      ))}
    </ul>
  )
}
