/** SummonButton — primary candle button: Summon / Summon again / Summoning… */
import s from './SummonButton.module.css'

export type SummonState = 'idle' | 'again' | 'summoning'

const LABEL: Record<SummonState, string> = {
  idle: 'Summon',
  again: 'Summon again',
  summoning: 'Summoning…',
}

interface SummonButtonProps {
  state: SummonState
  disabled: boolean
  onClick: () => void
}

export function SummonButton({ state, disabled, onClick }: SummonButtonProps) {
  return (
    <button
      type="button"
      className={`${s.summon} ${state === 'summoning' ? s.busy : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={LABEL[state]}
    >
      <span className={s.lab}>{LABEL[state]}</span>
      <span className={s.kbd}>⌘⏎</span>
      <svg className={s.mobIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M13 3v5a2 2 0 0 1-2 2H3m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
