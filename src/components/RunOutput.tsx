/**
 * RunOutput — CRT terminal with a COBOL / Python toggle and the AgreementBar.
 * Both terminals stay mounted (the inactive one is hidden) so the Result_Line
 * flickerIn plays once. When the Python run fails, the Python tab opens and
 * shows the runtime-error state (Req 6.4).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Run, Agreement } from '../lib/schemas.ts'
import { RESULT_LINE } from '../lib/results.ts'
import { AgreementBar } from './AgreementBar.tsx'
import s from './RunOutput.module.css'

type Tab = 'cobol' | 'python'

interface RunOutputProps {
  cobolRun?: Run
  pythonRun?: Run
  agreement?: Agreement
  /** true while either run is still in progress (hides the AgreementBar, Req 7.5) */
  running: boolean
  /** which run failed, if any; its tab opens automatically */
  failed?: Tab
  onAskWhy: () => void
  onFix: () => void
  onEdit: () => void
}

function PythonFailure({ run, onFix, onEdit }: { run: Run; onFix: () => void; onEdit: () => void }) {
  const title = run.timedOut
    ? `› Python ran, then stopped answering after ${run.timeLimitSec ?? 10} seconds.`
    : '› Python stopped with an error.'
  return (
    <div className={s.failHead} role="alert">
      <div className={s.error}>{title}</div>
      <div className={s.failActions}>
        <button type="button" className={s.act} onClick={onFix}>Let the ghost fix it</button>
        <button type="button" className={s.act} onClick={onEdit}>Edit the task</button>
      </div>
    </div>
  )
}

function Terminal({ run, hidden, head }: { run?: Run; hidden: boolean; head?: ReactNode }) {
  const lines = run ? run.stdout.split('\n').filter(l => l !== '') : []
  return (
    <div className={`${s.term} crt`} role="log" aria-label="Program output" hidden={hidden}>
      {!run && <div className={s.dim}>› Waiting for the program to run…</div>}
      {head}
      {lines.map((line, i) =>
        RESULT_LINE.test(line)
          ? <div key={i} className={s.result}>{line}</div>
          : <div key={i} className={s.line}>{`› ${line}`}</div>,
      )}
      {run?.stderr && !run.compileError && <div className={s.error}>{run.stderr}</div>}
    </div>
  )
}

export function RunOutput({ cobolRun, pythonRun, agreement, running, failed, onAskWhy, onFix, onEdit }: RunOutputProps) {
  const [tab, setTab] = useState<Tab>('cobol')
  // open the failed run's tab once when a failure arrives (React's
  // "adjust state when a prop changes" pattern; no effect, no extra render)
  const [seenFailure, setSeenFailure] = useState<Tab | undefined>(undefined)
  if (failed !== seenFailure) {
    setSeenFailure(failed)
    if (failed) setTab(failed)
  }

  const pythonHead = failed === 'python' && pythonRun
    ? <PythonFailure run={pythonRun} onFix={onFix} onEdit={onEdit} />
    : undefined

  return (
    <section className={`${s.pane} ${s.out}`} aria-label="Run output">
      <div className={s.paneH}>
        <div className={s.seg} role="group" aria-label="Output source">
          <button type="button" aria-pressed={tab === 'cobol'} onClick={() => setTab('cobol')}>COBOL</button>
          <button type="button" aria-pressed={tab === 'python'} onClick={() => setTab('python')}>
            Python{failed === 'python' && <span className={s.flag} aria-label="failed"> ●</span>}
          </button>
        </div>
      </div>
      <Terminal run={cobolRun} hidden={tab !== 'cobol'} />
      <Terminal run={pythonRun} hidden={tab !== 'python'} head={pythonHead} />
      {!running && !failed && agreement && <AgreementBar agreement={agreement} onAsk={onAskWhy} />}
    </section>
  )
}
