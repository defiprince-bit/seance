/**
 * Workspace — renders the AppShell from the séance state and routes every
 * state to a visible pane:
 *
 *   column 1  CodePane when there is a program; SummoningSkeleton while
 *             summoning; EmptyState otherwise
 *   column 2  ErrorState for any failure except a Python one; GhostNarration otherwise
 *   column 3  TranslationPane + RunOutput (Python failures show there, Req 6.4)
 *
 * Keyboard: Ctrl/Cmd+Enter (TaskInput), `/` (TaskInput), j / k, Esc.
 */
import { useEffect, useCallback, useState } from 'react'
import { pillStatus } from '../state/seance.ts'
import { useSeance } from '../state/useSeance.ts'
import { activeRangeOf } from '../lib/ranges.ts'
import { summarizeCompileError, buildFixTask } from '../lib/compileError.ts'
import { AppShell } from './AppShell.tsx'
import { TopBar } from './TopBar.tsx'
import { TaskInput, TASK_INPUT_ID } from './TaskInput.tsx'
import { CodePane } from './CodePane.tsx'
import { GhostNarration, ASK_INPUT_ID } from './GhostNarration.tsx'
import { TranslationPane } from './TranslationPane.tsx'
import { RunOutput } from './RunOutput.tsx'
import { EmptyState } from './EmptyState.tsx'
import { SummoningSkeleton } from './SummoningSkeleton.tsx'
import { ErrorState } from './ErrorState.tsx'

const PLAY_STEP_MS = 5000

export function Workspace() {
  const { state, dispatch, summon, abort, reset } = useSeance()
  const [playRequested, setPlayRequested] = useState(false)
  const { error, program } = state

  const activeRange = activeRangeOf(state.steps, state.activeIndex)
  const playing = playRequested && state.activeIndex < state.steps.length - 1
  const lines = program?.lines ?? []
  const compile = error?.kind === 'compile' && error.line !== undefined
    ? { line: error.line, token: summarizeCompileError(error.message, error.line, lines).token }
    : undefined

  // Play is the only thing that advances narration on its own
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => dispatch({ type: 'STEP_NEXT' }), PLAY_STEP_MS)
    return () => clearTimeout(t)
  }, [playing, state.activeIndex, dispatch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (abort()) setPlayRequested(false); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'j') { e.preventDefault(); dispatch({ type: 'STEP_NEXT' }) }
      else if (e.key === 'k') { e.preventDefault(); dispatch({ type: 'STEP_PREV' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abort, dispatch])

  const start = useCallback((task?: string) => { setPlayRequested(false); void summon(task) }, [summon])

  const pick = useCallback((task: string) => {
    dispatch({ type: 'SET_TASK', task }) // the chip fills TaskInput…
    start(task)                          // …and summons it (golden replay is task 10)
  }, [dispatch, start])

  const edit = useCallback(() => {
    const el = document.getElementById(TASK_INPUT_ID) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }, [])

  // Stub for "Let the ghost fix it": re-summon with the task plus the failure.
  // The full fix loop lives in the ghost-narrator spec.
  const fix = useCallback(() => {
    if (!error) return
    const failure = error.kind === 'compile'
      ? `GnuCOBOL said, at line ${error.line ?? '?'}: ${summarizeCompileError(error.message, error.line, lines).technical}`
      : error.kind === 'timeout' ? 'it ran past its time limit without finishing.'
      : error.message
    start(buildFixTask(state.task, failure))
  }, [error, lines, start, state.task])

  const codeColumn = program
    ? <CodePane key={state.runId} lines={lines} activeRange={activeRange} streaming filename={program.filename} errorAt={compile} />
    : state.phase === 'summoning' ? <SummoningSkeleton /> : <EmptyState onPick={pick} />

  const ghostColumn = error && error.step !== 'python'
    ? <ErrorState error={error} sourceLines={lines} onFix={fix} onEdit={edit} onRetry={() => start()} onPick={pick} />
    : (
      <GhostNarration
        steps={state.steps}
        activeIndex={state.activeIndex}
        playing={playing}
        waiting={program ? 'The ghost is reading the program…' : 'The ghost is waiting for a program.'}
        onStep={i => dispatch({ type: 'SET_ACTIVE', index: i })}
        onPrev={() => dispatch({ type: 'STEP_PREV' })}
        onNext={() => dispatch({ type: 'STEP_NEXT' })}
        onTogglePlay={() => setPlayRequested(p => !p)}
      />
    )

  return (
    <AppShell
      top={<TopBar sessionTitle={program?.title ?? ''} status={pillStatus(state)} onEnd={() => { setPlayRequested(false); reset() }} />}
      task={
        <TaskInput
          value={state.task}
          phase={state.phase}
          hasRun={program !== undefined || error !== undefined}
          onChange={task => dispatch({ type: 'SET_TASK', task })}
          onSubmit={() => start()}
        />
      }
      code={codeColumn}
      ghost={ghostColumn}
      python={
        <>
          <TranslationPane lines={state.python} activeRange={activeRange} note={state.note} />
          <RunOutput
            cobolRun={state.cobolRun}
            pythonRun={state.pythonRun}
            agreement={state.agreement}
            running={!state.cobolRun || !state.pythonRun}
            failed={error?.step === 'python' ? 'python' : error?.step === 'run' ? 'cobol' : undefined}
            onAskWhy={() => document.getElementById(ASK_INPUT_ID)?.focus()}
            onFix={fix}
            onEdit={edit}
          />
        </>
      }
    />
  )
}
