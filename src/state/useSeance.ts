/**
 * src/state/useSeance.ts
 * Runs the pipeline against the reducer: summon → (run ∥ narrate) → python → agree.
 * Every failure dispatches an error that names its step. Esc (abort) restores
 * the state from before the summon.
 */
import { useReducer, useRef, useCallback } from 'react'
import { reducer, initial, runFailure } from './seance.ts'
import type { SeanceState, PipelineStep, CsvData } from './seance.ts'
import { replayPlan } from './replay.ts'
import type { GoldenSeance } from '../lib/golden.ts'
import { encodeStdin } from '../lib/stdin.ts'
import { numberSource } from '../lib/numbering.ts'
import { isSummonSuccess } from '../lib/schemas.ts'
import type { Run } from '../lib/schemas.ts'
import { apiSummon, apiRun, apiNarrate, ApiError } from '../services/api.ts'
import { runPython } from '../services/python.ts'

/** Resolves true after `ms`, or false as soon as the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return }
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(true) }, ms)
    const onAbort = () => { clearTimeout(t); resolve(false) }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function useSeance() {
  const [state, dispatch] = useReducer(reducer, initial)
  const abortRef = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const snapshot = useRef<SeanceState>(initial)
  const latest = useRef(state)
  latest.current = state

  const abort = useCallback((): boolean => {
    if (!inFlight.current) return false
    abortRef.current?.abort()
    inFlight.current = false
    dispatch({ type: 'RESTORE', snapshot: snapshot.current })
    return true
  }, [])

  /**
   * Starts a summon. `taskOverride` is what gets sent to the model (chip picks,
   * "Let the ghost fix it"); the task box keeps whatever the user typed.
   */
  const summon = useCallback(async (taskOverride?: string, csvOverride?: CsvData | null) => {
    const current = latest.current
    const task = (taskOverride ?? current.task).trim()
    if (!task || inFlight.current) return
    // null = no CSV for this séance; undefined = keep whatever the state has
    const csv = csvOverride === undefined ? current.csv : csvOverride ?? undefined
    if (csvOverride !== undefined) dispatch({ type: 'SET_CSV', csv })

    const ctrl = new AbortController()
    abortRef.current = ctrl
    inFlight.current = true
    snapshot.current = current
    const stale = () => ctrl.signal.aborted

    const failStep = (step: PipelineStep, err: unknown) => {
      if (stale() || (err instanceof Error && err.name === 'AbortError')) return
      const kind = err instanceof ApiError ? err.kind : 'invalid'
      const message = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'STEP_FAILED', step, kind, message })
    }

    dispatch({ type: 'SUMMON_START' })
    const stdin = encodeStdin(csv?.text)

    try {
      // 1. summon
      let res
      try {
        res = await apiSummon(task, csv?.text.split(/\r?\n/)[0], ctrl.signal)
      } catch (err) { failStep('summon', err); return }
      if (stale()) return
      if (!isSummonSuccess(res)) { dispatch({ type: 'SUMMON_UNSUPPORTED', reason: res.reason }); return }

      const { program } = res
      dispatch({ type: 'PROGRAM_RECEIVED', program })

      // 2. run ∥ narrate
      const runP: Promise<Run | null> = apiRun(program.lines.join('\n'), stdin, ctrl.signal)
        .then(run => { if (!stale()) dispatch({ type: 'COBOL_RUN_DONE', run }); return run })
        .catch(err => { failStep('run', err); return null })
      const narrateP = apiNarrate(task, numberSource(program.lines), program.lines.length, ctrl.signal)
        .then(n => { if (!stale()) dispatch({ type: 'NARRATE_DONE', steps: n.steps, python: n.python, note: n.note }); return n })
        .catch(err => { failStep('narrate', err); return null })
      const [cobolRun, narration] = await Promise.all([runP, narrateP])
      if (stale() || !cobolRun || !narration || runFailure(cobolRun, 'run')) return

      // 3. python, with the same stdin
      let pythonRun: Run
      try {
        pythonRun = await runPython(narration.python.map(l => l.text).join('\n'), stdin)
      } catch (err) {
        pythonRun = { stdout: '', stderr: err instanceof Error ? err.message : 'The Python worker failed to start.', exitCode: 1, runner: 'pyodide' }
      }
      if (stale()) return
      dispatch({ type: 'PYTHON_RUN_DONE', run: pythonRun })

      // 4. agree (the reducer skips this if anything failed)
      dispatch({ type: 'AGREE' })
    } finally {
      if (abortRef.current === ctrl) inFlight.current = false
    }
  }, [])

  /**
   * Replays a golden séance: the same actions a live séance dispatches, on a
   * timer, so the full animation plays. No API or Pyodide call is made. Esc
   * cancels it like a live summon (abort restores the earlier state).
   */
  const replay = useCallback(async (golden: GoldenSeance) => {
    if (inFlight.current) return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    inFlight.current = true
    snapshot.current = latest.current
    try {
      for (const step of replayPlan(golden)) {
        if (step.waitMs > 0 && !(await wait(step.waitMs, ctrl.signal))) return
        if (ctrl.signal.aborted) return
        dispatch(step.action)
      }
    } finally {
      if (abortRef.current === ctrl) inFlight.current = false
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    inFlight.current = false
    dispatch({ type: 'RESET' })
  }, [])

  return { state, dispatch, summon, replay, abort, reset }
}
