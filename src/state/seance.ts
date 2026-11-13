/**
 * src/state/seance.ts
 * Single reducer for the séance pipeline. Pure: no fetch, no timers.
 * Async work lives in src/state/useSeance.ts.
 *
 * Every failure becomes one SeanceError naming the step that failed, so no
 * pane is ever left silently empty. The first failure wins: a later failure
 * from the parallel branch does not overwrite it.
 */
import type { Program, Run, Step, PyLine, Agreement } from '../lib/schemas.ts'
import { clampIndex } from '../lib/ranges.ts'
import { agree } from '../lib/results.ts'

export type Phase = 'idle' | 'summoning' | 'running' | 'narrating' | 'ready' | 'error'
export type PipelineStep = 'summon' | 'run' | 'narrate' | 'python'
export type ErrorKind = 'compile' | 'runtime' | 'timeout' | 'unsupported' | 'busy' | 'invalid'

export interface CsvData { name: string; rows: number; text: string }

export interface SeanceError {
  kind: ErrorKind
  step: PipelineStep
  message: string
  line?: number
  /** time limit that was hit, for the timeout copy */
  seconds?: number
}

export interface SeanceState {
  phase: Phase
  task: string
  csv?: CsvData
  program?: Program
  cobolRun?: Run
  steps: Step[]
  python: PyLine[]
  note?: string
  pythonRun?: Run
  agreement?: Agreement
  activeIndex: number
  error?: SeanceError
  cached: boolean
  /** bumps with every new program so the CodePane replays its entrance */
  runId: number
}

export const initial: SeanceState = {
  phase: 'idle', task: '', steps: [], python: [], activeIndex: 0, cached: false, runId: 0,
}

export type Action =
  | { type: 'SET_TASK'; task: string }
  | { type: 'SUMMON_START' }
  | { type: 'RESTORE'; snapshot: SeanceState }
  | { type: 'RESET' }
  | { type: 'PROGRAM_RECEIVED'; program: Program }
  | { type: 'SUMMON_UNSUPPORTED'; reason: string }
  | { type: 'STEP_FAILED'; step: PipelineStep; kind: 'busy' | 'invalid'; message: string }
  | { type: 'COBOL_RUN_DONE'; run: Run }
  | { type: 'NARRATE_DONE'; steps: Step[]; python: PyLine[]; note?: string }
  | { type: 'PYTHON_RUN_DONE'; run: Run }
  | { type: 'AGREE' }
  | { type: 'SET_ACTIVE'; index: number }
  | { type: 'STEP_PREV' }
  | { type: 'STEP_NEXT' }

/** Enter the error phase unless an earlier failure is already showing. */
function fail(state: SeanceState, error: SeanceError, patch: Partial<SeanceState> = {}): SeanceState {
  if (state.error) return { ...state, ...patch }
  return { ...state, ...patch, phase: 'error', error }
}

/** Classifies a finished run: undefined means it succeeded. */
export function runFailure(run: Run, step: 'run' | 'python'): SeanceError | undefined {
  if (run.compileError) {
    return { kind: 'compile', step, message: run.compileError.message, line: run.compileError.line }
  }
  if (run.timedOut) {
    return { kind: 'timeout', step, message: run.stderr ?? 'The run hit its time limit.', seconds: run.timeLimitSec }
  }
  if (run.exitCode !== 0) {
    return { kind: 'runtime', step, message: run.stderr?.trim() || `Exited with code ${run.exitCode}.` }
  }
  return undefined
}

export function reducer(state: SeanceState, action: Action): SeanceState {
  switch (action.type) {
    case 'SET_TASK':
      return { ...state, task: action.task }

    case 'SUMMON_START':
      return { ...state, phase: 'summoning', error: undefined }

    // Esc: put back exactly what was on screen before the summon started (Req 3.6)
    case 'RESTORE':
      return { ...action.snapshot, task: state.task }

    case 'RESET':
      return initial

    case 'PROGRAM_RECEIVED':
      return {
        ...state,
        phase: 'running',
        program: action.program,
        cobolRun: undefined, steps: [], python: [], note: undefined,
        pythonRun: undefined, agreement: undefined, activeIndex: 0,
        error: undefined, cached: false, runId: state.runId + 1,
      }

    case 'SUMMON_UNSUPPORTED':
      // nothing else runs (Req 3.5), and the old program is cleared from view
      return {
        ...initial, task: state.task, csv: state.csv, runId: state.runId,
        phase: 'error', error: { kind: 'unsupported', step: 'summon', message: action.reason },
      }

    case 'STEP_FAILED': {
      const error: SeanceError = { kind: action.kind, step: action.step, message: action.message }
      // a summon failure means the old program is no longer what the user asked for
      if (action.step === 'summon') {
        return { ...initial, task: state.task, csv: state.csv, runId: state.runId, phase: 'error', error }
      }
      return fail(state, error)
    }

    case 'COBOL_RUN_DONE': {
      const failure = runFailure(action.run, 'run')
      if (failure) return fail(state, failure, { cobolRun: action.run })
      return { ...state, cobolRun: action.run }
    }

    case 'NARRATE_DONE':
      return {
        ...state,
        steps: action.steps, python: action.python, note: action.note, activeIndex: 0,
        phase: state.phase === 'error' ? 'error' : 'narrating',
      }

    case 'PYTHON_RUN_DONE': {
      const failure = runFailure(action.run, 'python')
      if (failure) return fail(state, failure, { pythonRun: action.run })
      return { ...state, pythonRun: action.run }
    }

    case 'AGREE': {
      if (state.error || !state.cobolRun || !state.pythonRun) return state
      return { ...state, phase: 'ready', agreement: agree(state.cobolRun.stdout, state.pythonRun.stdout) }
    }

    case 'SET_ACTIVE':
      return { ...state, activeIndex: clampIndex(action.index, state.steps.length) }
    case 'STEP_PREV':
      return { ...state, activeIndex: clampIndex(state.activeIndex - 1, state.steps.length) }
    case 'STEP_NEXT':
      return { ...state, activeIndex: clampIndex(state.activeIndex + 1, state.steps.length) }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// StatusPill mapping (pure, so it is unit-tested with the reducer)
// ---------------------------------------------------------------------------

export type PillTone = 'idle' | 'summoning' | 'present' | 'error'

export function pillStatus(state: SeanceState): { tone: PillTone; label: string } {
  if (state.phase === 'idle') return { tone: 'idle', label: 'Candles lit' }
  if (state.phase === 'summoning') return { tone: 'summoning', label: 'Summoning' }
  if (state.phase === 'error' && state.error) {
    const label = {
      compile: "Didn't compile",
      runtime: 'Run failed',
      timeout: 'Run failed',
      unsupported: "Can't summon that",
      busy: 'Spirits busy',
      invalid: 'Ghost mumbled',
    }[state.error.kind]
    return { tone: 'error', label }
  }
  return { tone: 'present', label: 'Spirit present' }
}
