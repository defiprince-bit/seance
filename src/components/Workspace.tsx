/**
 * Workspace — wires the reducer to the APIs and the Pyodide worker, and renders
 * the AppShell. Pipeline: summon → (run ∥ narrate) → python → agree.
 * Keyboard: Ctrl/Cmd+Enter (in TaskInput), `/` (TaskInput), j / k, Esc.
 */
import { useReducer, useEffect, useRef, useCallback, useState } from 'react'
import { reducer, initial } from '../state/seance.ts'
import type { SeanceState } from '../state/seance.ts'
import { activeRangeOf } from '../lib/ranges.ts'
import { encodeStdin } from '../lib/stdin.ts'
import { numberSource } from '../lib/numbering.ts'
import { isSummonSuccess } from '../lib/schemas.ts'
import type { Run } from '../lib/schemas.ts'
import { runPython } from '../services/python.ts'
import { apiSummon, apiRun, apiNarrate, BusyError } from '../services/api.ts'
import { AppShell } from './AppShell.tsx'
import { TopBar } from './TopBar.tsx'
import { TaskInput } from './TaskInput.tsx'
import { CodePane } from './CodePane.tsx'
import { GhostNarration, ASK_INPUT_ID } from './GhostNarration.tsx'
import { TranslationPane } from './TranslationPane.tsx'
import { RunOutput } from './RunOutput.tsx'

const PLAY_STEP_MS = 5000

const runFailed = (r: Run) => Boolean(r.compileError) || Boolean(r.timedOut) || r.exitCode !== 0

export function Workspace() {
  const [state, dispatch] = useReducer(reducer, initial)
  const [playRequested, setPlayRequested] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const snapshot = useRef<SeanceState>(initial)

  // activeIndex is the single source of truth; every pane derives from this
  const activeRange = activeRangeOf(state.steps, state.activeIndex)
  const atEnd = state.activeIndex >= state.steps.length - 1
  const playing = playRequested && !atEnd

  // ── Play: the only thing that may advance narration on its own ───────────
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => dispatch({ type: 'STEP_NEXT' }), PLAY_STEP_MS)
    return () => clearTimeout(t)
  }, [playing, state.activeIndex])

  // ── Abort: Esc cancels everything in flight and restores the prior state ──
  const abortInFlight = useCallback(() => {
    if (!inFlight.current) return
    abortRef.current?.abort()
    inFlight.current = false
    setPlayRequested(false)
    dispatch({ type: 'RESTORE', snapshot: snapshot.current })
  }, [])

  // ── j / k / Esc ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { abortInFlight(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'j') { e.preventDefault(); dispatch({ type: 'STEP_NEXT' }) }
      else if (e.key === 'k') { e.preventDefault(); dispatch({ type: 'STEP_PREV' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abortInFlight])

  // ── The pipeline ─────────────────────────────────────────────────────────
  const handleSummon = useCallback(async () => {
    const task = state.task.trim()
    if (!task || inFlight.current) return

    const ctrl = new AbortController()
    abortRef.current = ctrl
    inFlight.current = true
    snapshot.current = state
    setPlayRequested(false)
    const stale = () => ctrl.signal.aborted

    const fail = (err: unknown) => {
      if (stale() || (err as Error).name === 'AbortError') return
      if (err instanceof BusyError) dispatch({ type: 'BUSY_ERROR' })
      else dispatch({ type: 'SUMMON_ERROR', message: (err as Error).message })
    }

    dispatch({ type: 'SUMMON_START' })
    const stdin = encodeStdin(state.csv?.text)

    try {
      // 1. summon
      let res
      try {
        res = await apiSummon(task, state.csv?.text.split('\n')[0], ctrl.signal)
      } catch (err) { fail(err); return }
      if (stale()) return
      if (!isSummonSuccess(res)) { dispatch({ type: 'SUMMON_UNSUPPORTED', reason: res.reason }); return }

      const { program } = res
      dispatch({ type: 'PROGRAM_RECEIVED', program })

      // 2. run ∥ narrate (both start before either is awaited)
      const runP = apiRun(program.lines.join('\n'), stdin, ctrl.signal)
        .then(run => { if (!stale()) dispatch({ type: 'COBOL_RUN_DONE', run }); return run })
        .catch(err => { fail(err); return null })
      const narrateP = apiNarrate(task, numberSource(program.lines), program.lines.length, ctrl.signal)
        .then(n => { if (!stale()) dispatch({ type: 'NARRATE_DONE', steps: n.steps, python: n.python, note: n.note }); return n })
        .catch(err => { fail(err); return null })
      const [cobolRun, narration] = await Promise.all([runP, narrateP])
      if (stale() || !cobolRun || !narration) return
      if (runFailed(cobolRun)) return // the error state is already showing

      // 3. python, with the same stdin
      const pythonRun = await runPython(narration.python.map(l => l.text).join('\n'), stdin)
      if (stale()) return
      dispatch({ type: 'PYTHON_RUN_DONE', run: pythonRun })

      // 4. agree
      dispatch({ type: 'AGREE' })
    } finally {
      if (abortRef.current === ctrl) inFlight.current = false
    }
  }, [state])

  return (
    <AppShell
      top={
        <TopBar
          sessionTitle={state.program?.title ?? ''}
          phase={state.phase}
          onEnd={() => { abortInFlight(); setPlayRequested(false); dispatch({ type: 'RESET' }) }}
        />
      }
      task={
        <TaskInput
          value={state.task}
          phase={state.phase}
          hasRun={state.program !== undefined}
          onChange={task => dispatch({ type: 'SET_TASK', task })}
          onSubmit={handleSummon}
        />
      }
      code={
        <CodePane
          key={state.runId}
          lines={state.program?.lines ?? []}
          activeRange={activeRange}
          streaming
          filename={state.program?.filename}
        />
      }
      ghost={
        <GhostNarration
          steps={state.steps}
          activeIndex={state.activeIndex}
          playing={playing}
          onStep={i => dispatch({ type: 'SET_ACTIVE', index: i })}
          onPrev={() => dispatch({ type: 'STEP_PREV' })}
          onNext={() => dispatch({ type: 'STEP_NEXT' })}
          onTogglePlay={() => setPlayRequested(p => !p)}
        />
      }
      python={
        <>
          <TranslationPane lines={state.python} activeRange={activeRange} note={state.note} />
          <RunOutput
            cobolRun={state.cobolRun}
            pythonRun={state.pythonRun}
            agreement={state.agreement}
            running={!state.cobolRun || !state.pythonRun}
            onAskWhy={() => document.getElementById(ASK_INPUT_ID)?.focus()}
          />
        </>
      }
    />
  )
}
