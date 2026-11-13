/** StatusPill — 26px role="status" pill with a breathing dot. */
import type { Phase } from '../state/seance.ts'
import s from './StatusPill.module.css'

const LABEL: Record<Phase, string> = {
  idle: 'Candles lit',
  summoning: 'Summoning',
  running: 'Summoning',
  narrating: 'Spirit present',
  ready: 'Spirit present',
  error: 'Run failed',
}

export function StatusPill({ phase }: { phase: Phase }) {
  const busy = phase === 'summoning' || phase === 'running'
  const cls = [s.pill, busy ? s.summoning : '', phase === 'error' ? s.error : ''].join(' ')
  return (
    <span className={cls} role="status">
      <i className={s.dot} />
      {LABEL[phase]}
    </span>
  )
}
