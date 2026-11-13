/**
 * src/state/seance.ts
 * Single reducer for the entire séance pipeline.
 * Pure — no fetch, no side-effects. All async work lives in Workspace.tsx.
 */
import type { Program, Run, Step, PyLine, Agreement } from '../lib/schemas.ts'
import { clampIndex } from '../lib/ranges.ts'
import { agree } from '../lib/results.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Phase = 'idle' | 'summoning' | 'running' | 'narrating' | 'ready' | 'error'

export interface CsvData { name: string; rows: number; text: string }

export interface SeanceError {
  kind: 'compile' | 'runtime' | 'timeout' | 'unsupported' | 'busy' | 'invalid'
  message: string
  line?: number
  token?: string
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
  phase: 'idle',
  task: '',
  steps: [],
  python: [],
  activeIndex: 0,
  cached: false,
  runId: 0,
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'SET_TASK'; task: string }
  | { type: 'SUMMON_START' }
  | { type: 'RESTORE'; snapshot: SeanceState }
  | { type: 'RESET' }
  | { type: 'PROGRAM_RECEIVED'; program: Program }
  | { type: 'SUMMON_UNSUPPORTED'; reason: string }
  | { type: 'SUMMON_ERROR'; message: string }
  | { type: 'COBOL_RUN_DONE'; run: Run }
  | { type: 'NARRATE_DONE'; steps: Step[]; python: PyLine[]; note?: string }
  | { type: 'PYTHON_RUN_DONE'; run: Run }
  | { type: 'AGREE' }
  | { type: 'SET_ACTIVE'; index: number }
  | { type: 'STEP_PREV' }
  | { type: 'STEP_NEXT' }
  | { type: 'BUSY_ERROR' }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

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
        cobolRun: undefined,
        steps: [],
        python: [],
        note: undefined,
        pythonRun: undefined,
        agreement: undefined,
        activeIndex: 0,
        error: undefined,
        cached: false,
        runId: state.runId + 1,
      }

    case 'SUMMON_UNSUPPORTED':
      return {
        ...state,
        phase: 'error',
        error: { kind: 'unsupported', message: action.reason },
      }

    case 'SUMMON_ERROR':
      return {
        ...state,
        phase: 'error',
        error: { kind: 'invalid', message: action.message },
      }

    case 'BUSY_ERROR':
      return {
        ...state,
        phase: 'error',
        error: { kind: 'busy', message: 'The spirits are busy. Try a cached séance.' },
      }

    case 'COBOL_RUN_DONE': {
      const run = action.run
      if (run.compileError) {
        return {
          ...state,
          cobolRun: run,
          phase: 'error',
          error: {
            kind: 'compile',
            message: run.compileError.message,
            line: run.compileError.line,
          },
        }
      }
      if (run.timedOut) {
        return {
          ...state,
          cobolRun: run,
          phase: 'error',
          error: { kind: 'timeout', message: 'The program ran, then stopped answering.' },
        }
      }
      if (run.exitCode !== 0) {
        return {
          ...state,
          cobolRun: run,
          phase: 'error',
          error: { kind: 'runtime', message: run.stderr ?? 'Runtime error' },
        }
      }
      // Successful run — check if Python also done
      const bothDone = state.pythonRun !== undefined
      return { ...state, cobolRun: run, phase: bothDone ? 'ready' : state.phase }
    }

    case 'NARRATE_DONE':
      return {
        ...state,
        steps: action.steps,
        python: action.python,
        note: action.note,
        // never overwrite an error raised by the COBOL run
        phase: state.phase === 'error' ? 'error' : 'narrating',
        activeIndex: 0,
      }

    case 'PYTHON_RUN_DONE': {
      const bothDone = state.cobolRun !== undefined
      return {
        ...state,
        pythonRun: action.run,
        phase: bothDone ? 'ready' : state.phase,
      }
    }

    case 'AGREE': {
      const cobolStdout = state.cobolRun?.stdout ?? ''
      const pythonStdout = state.pythonRun?.stdout ?? ''
      return { ...state, phase: 'ready', agreement: agree(cobolStdout, pythonStdout) }
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
