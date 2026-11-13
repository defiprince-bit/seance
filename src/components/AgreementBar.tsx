/**
 * AgreementBar — the proof moment (Req 7). Sits at the bottom of RunOutput and
 * rises in once. The parent hides it while either run is in progress.
 */
import type { Agreement } from '../lib/schemas.ts'
import s from './AgreementBar.module.css'

interface AgreementBarProps {
  agreement: Agreement
  onAsk: () => void
}

export function AgreementBar({ agreement, onAsk }: AgreementBarProps) {
  if (agreement.status === 'no-result') {
    return <div className={`${s.bar} ${s.rise}`}>No result line to compare.</div>
  }

  if (agreement.status === 'match') {
    const printed = agreement.cobolValue?.trim() ?? ''
    return (
      <div className={`${s.bar} ${s.rise}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7 5.5 10 11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={s.okIcon}/>
        </svg>
        <span><b className={s.ok}>Python agrees.</b> Both runs print {printed}.</span>
      </div>
    )
  }

  return (
    <div className={`${s.bar} ${s.rise} ${s.bad}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span>
        <b>Results differ:</b> COBOL {agreement.cobolValue ?? '(missing)'}, Python {agreement.pythonValue ?? '(missing)'}
      </span>
      <button type="button" className={s.ask} onClick={onAsk}>Ask the ghost why</button>
    </div>
  )
}
