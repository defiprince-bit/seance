/**
 * RunOutput — CRT terminal with a COBOL / Python toggle and the AgreementBar.
 * Both terminals stay mounted (the inactive one is hidden) so the Result_Line
 * flickerIn plays once and does not replay when you switch tabs.
 */
import { useState } from 'react'
import type { Run, Agreement } from '../lib/schemas.ts'
import { RESULT_LINE } from '../lib/results.ts'
import { AgreementBar } from './AgreementBar.tsx'
import s from './RunOutput.module.css'

interface RunOutputProps {
  cobolRun?: Run
  pythonRun?: Run
  agreement?: Agreement
  /** true while either run is still in progress (hides the AgreementBar, Req 7.5) */
  running: boolean
  onAskWhy: () => void
}


function Terminal({ run, hidden }: { run?: Run; hidden: boolean }) {
  const lines = run ? run.stdout.split('\n').filter(l => l !== '') : []
  return (
    <div className={`${s.term} crt`} role="log" aria-label="Program output" hidden={hidden}>
      {!run && <div className={s.dim}>› Waiting for the program to run…</div>}
      {lines.map((line, i) =>
        RESULT_LINE.test(line)
          ? <div key={i} className={s.result}>{line}</div>
          : <div key={i} className={s.line}>{`› ${line}`}</div>,
      )}
      {run?.stderr && !run.compileError && <div className={s.error}>{run.stderr}</div>}
    </div>
  )
}

export function RunOutput({ cobolRun, pythonRun, agreement, running, onAskWhy }: RunOutputProps) {
  const [tab, setTab] = useState<'cobol' | 'python'>('cobol')

  return (
    <section className={`${s.pane} ${s.out}`} aria-label="Run output">
      <div className={s.paneH}>
        <div className={s.seg} role="group" aria-label="Output source">
          <button type="button" aria-pressed={tab === 'cobol'} onClick={() => setTab('cobol')}>COBOL</button>
          <button type="button" aria-pressed={tab === 'python'} onClick={() => setTab('python')}>Python</button>
        </div>
      </div>
      <Terminal run={cobolRun} hidden={tab !== 'cobol'} />
      <Terminal run={pythonRun} hidden={tab !== 'python'} />
      {!running && agreement && <AgreementBar agreement={agreement} onAsk={onAskWhy} />}
    </section>
  )
}
