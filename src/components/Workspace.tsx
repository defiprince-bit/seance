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
import type { CsvData } from '../state/seance.ts'
import { chipByLabel } from '../lib/golden.ts'
import { goldenFor } from '../services/golden.ts'
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
  const { state, dispatch, summon, replay, abort, reset } = useSeance()
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

  // a typed task never carries a chip's sample CSV (file attach is task 12)
  const start = useCallback((task?: string, csv?: CsvData | null) => {
    setPlayRequested(false)
    void summon(task, task === undefined && csv === undefined ? null : csv)
  }, [summon])

  // A chip replays its golden séance (Req 2.2); with no fixture it summons live.
  const pick = useCallback((label: string) => {
    const chip = chipByLabel(label)
    if (!chip) { dispatch({ type: 'SET_TASK', task: label }); start(label); return }
    dispatch({ type: 'SET_TASK', task: chip.task })
    setPlayRequested(false)
    const golden = goldenFor(chip.slug)
    if (golden) { void replay(golden); return }
    start(chip.task, chip.csv ? { name: chip.csv.name, rows: chip.csv.text.trim().split(/\r?\n/).length - 1, text: chip.csv.text } : null)
  }, [dispatch, start, replay])

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
    // keep the séance's CSV (e.g. a chip's sample) for the retry
    start(buildFixTask(state.task, failure), state.csv ?? null)
  }, [error, lines, start, state.task, state.csv])

  const codeColumn = program
    ? <CodePane key={state.runId} lines={lines} activeRange={activeRange} streaming filename={program.filename} errorAt={compile} cached={state.cached} />
    : state.phase === 'summoning' ? <SummoningSkeleton /> : <EmptyState onPick={pick} />

  const ghostColumn = error && error.step !== 'python'
    ? <ErrorState error={error} sourceLines={lines} onFix={fix} onEdit={edit} onRetry={() => start(undefined, state.csv ?? null)} onPick={pick} />
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
      top={
        <TopBar
          sessionTitle={program?.title ?? ''}
          status={pillStatus(state)}
          onEnd={() => { setPlayRequested(false); reset() }}
          // only COBOL can be chosen, so the request is unchanged (language 'cobol')
          onSpiritConfirm={() => { if (state.task.trim()) start(); else edit() }}
        />
      }
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
