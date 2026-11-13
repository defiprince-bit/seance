/**
 * ErrorState — what the ghost pane shows when any step fails. It always says
 * which step failed. Kinds: compile · runtime · timeout · unsupported, plus the
 * invalid ("ghost mumbled") and busy variants. Copy follows seance-design.md.
 */
import type { SeanceError, PipelineStep } from '../state/seance.ts'
import { summarizeCompileError } from '../lib/compileError.ts'
import { SuggestionChips } from './Chip.tsx'
import s from './StatePane.module.css'

const DOING: Record<PipelineStep, string> = {
  summon: 'writing the program',
  run: 'running the COBOL',
  narrate: 'explaining the program',
  python: 'running the Python',
}

interface ErrorStateProps {
  error: SeanceError
  sourceLines: readonly string[]
  onFix: () => void
  onEdit: () => void
  onRetry: () => void
  onPick: (task: string) => void
}

function Btn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" className={`${s.btn} ${primary ? s.candle : ''}`} onClick={onClick}>{label}</button>
}

/** The error line with the token underlined (wavy danger). */
function ErrorLine({ line, text, token }: { line: number; text: string; token?: string }) {
  const at = token ? text.toUpperCase().indexOf(token.toUpperCase()) : -1
  return (
    <pre className={`${s.errLine} crt`}>
      <span className={s.lineNo}>{String(line).padStart(2)}  </span>
      {at < 0 ? text.trimStart() : (
        <>
          {text.slice(0, at).trimStart()}
          <span className={s.token}>{text.slice(at, at + token!.length)}</span>
          {text.slice(at + token!.length)}
        </>
      )}
    </pre>
  )
}

function Body({ error, sourceLines, onFix, onEdit, onRetry, onPick }: ErrorStateProps) {
  const fixAndEdit = <div className={s.actions}><Btn label="Let the ghost fix it" onClick={onFix} primary /><Btn label="Edit the task" onClick={onEdit} /></div>

  switch (error.kind) {
    case 'compile': {
      const sum = summarizeCompileError(error.message, error.line, sourceLines)
      const text = error.line !== undefined ? sourceLines[error.line - 1] : undefined
      return <>
        <h4 className={s.title}>
          {error.line !== undefined ? `The spirit lost the thread on line ${error.line}.` : 'The spirit lost the thread.'}
        </h4>
        {error.line !== undefined && text !== undefined && <ErrorLine line={error.line} text={text} token={sum.token} />}
        <p className={s.danger}>{sum.plain}</p>
        <details className={s.details}><summary>Compiler message</summary><pre>{error.message}</pre></details>
        {fixAndEdit}
      </>
    }
    case 'runtime':
      return <>
        <h4 className={s.title}>
          {error.step === 'python' ? 'The Python translation stopped with an error.' : 'The program compiled, then stumbled while running.'}
        </h4>
        <pre className={`${s.stderr} crt`}>{error.message}</pre>
        {fixAndEdit}
      </>
    case 'timeout':
      return <>
        <h4 className={s.title}>
          {`The ${error.step === 'python' ? 'Python translation' : 'program'} ran, then stopped answering${error.seconds ? ` after ${error.seconds} seconds` : ''}.`}
        </h4>
        <p className={s.text}>It may be waiting for input that never comes, or looping without an exit.</p>
        {fixAndEdit}
      </>
    case 'unsupported':
      return <>
        <h4 className={s.title}>That one is beyond a 1959 machine.</h4>
        <p className={s.text}>{error.message}</p>
        <p className={s.text}>COBOL works with text in and text out. Try a task like these:</p>
        <SuggestionChips onPick={onPick} />
        <div className={s.actions}><Btn label="Edit the task" onClick={onEdit} /></div>
      </>
    case 'invalid':
      return <>
        <h4 className={s.title}>The ghost mumbled. Summon again.</h4>
        <p className={s.text}>Its answer came back garbled while {DOING[error.step]}.</p>
        <details className={s.details}><summary>Details</summary><pre>{error.message}</pre></details>
        <div className={s.actions}><Btn label="Summon again" onClick={onRetry} primary /><Btn label="Edit the task" onClick={onEdit} /></div>
      </>
    case 'busy':
      return <>
        <h4 className={s.title}>The spirits are busy. Try a cached séance.</h4>
        <p className={s.text}>The service was too busy while {DOING[error.step]}. Wait a moment and summon again, or pick a sample.</p>
        <SuggestionChips onPick={onPick} />
        <div className={s.actions}><Btn label="Summon again" onClick={onRetry} /></div>
      </>
  }
}

export function ErrorState(props: ErrorStateProps) {
  return (
    <section className={s.pane} aria-label="What went wrong">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}>The ghost</h3>
        <span className={s.meta}>stopped while {DOING[props.error.step]}</span>
      </div>
      {/* role=alert so screen readers hear the failure once */}
      <div className={s.body} role="alert">
        <Body {...props} />
      </div>
    </section>
  )
}
