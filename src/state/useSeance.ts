/**
 * src/state/useSeance.ts
 * Runs the pipeline against the reducer: summon → (run ∥ narrate) → python → agree.
 * Every failure dispatches an error that names its step. Esc (abort) restores
 * the state from before the summon.
 */
import { useReducer, useRef, useCallback } from 'react'
import { reducer, initial, runFailure } from './seance.ts'
import type { SeanceState, PipelineStep } from './seance.ts'
import { encodeStdin } from '../lib/stdin.ts'
import { numberSource } from '../lib/numbering.ts'
import { isSummonSuccess } from '../lib/schemas.ts'
import type { Run } from '../lib/schemas.ts'
import { apiSummon, apiRun, apiNarrate, ApiError } from '../services/api.ts'
import { runPython } from '../services/python.ts'

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
  const summon = useCallback(async (taskOverride?: string) => {
    const current = latest.current
    const task = (taskOverride ?? current.task).trim()
    if (!task || inFlight.current) return

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
    const stdin = encodeStdin(current.csv?.text)

    try {
      // 1. summon
      let res
      try {
        res = await apiSummon(task, current.csv?.text.split(/\r?\n/)[0], ctrl.signal)
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

  const reset = useCallback(() => {
    abortRef.current?.abort()
    inFlight.current = false
    dispatch({ type: 'RESET' })
  }, [])

  return { state, dispatch, summon, abort, reset }
}
