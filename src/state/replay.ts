/**
 * src/state/replay.ts
 * Turns a golden séance into a timed list of the same reducer actions a live
 * séance dispatches, so a chip replay looks like the real thing: skeleton,
 * lines streaming in, planchette and narration, both runs, then the
 * agreement bar. Pure; useSeance plays the plan with cancellable timers.
 */
import type { Action } from './seance.ts'
import type { GoldenSeance } from '../lib/golden.ts'

export interface ReplayStep {
  /** wait this long after the previous step */
  waitMs: number
  action: Action
}

export interface ReplayTiming {
  /** how long the "ghost is writing" skeleton shows */
  summonMs: number
  /** per-line stagger of the code streaming in (matches CodePane's 40 ms) */
  lineMs: number
  /** pause after the run output appears before the narration */
  narrateMs: number
  /** pause before the Python run lands */
  pythonMs: number
  /** pause before the agreement bar rises */
  agreeMs: number
}

export const DEFAULT_TIMING: ReplayTiming = { summonMs: 900, lineMs: 40, narrateMs: 500, pythonMs: 700, agreeMs: 300 }

export function replayPlan(golden: GoldenSeance, timing: ReplayTiming = DEFAULT_TIMING): ReplayStep[] {
  const { program, cobolRun, narration, pythonRun } = golden
  return [
    { waitMs: 0, action: { type: 'SET_CSV', csv: golden.csv ? { name: golden.csv.name, rows: dataRows(golden.csv.text), text: golden.csv.text } : undefined } },
    { waitMs: 0, action: { type: 'SUMMON_START' } },
    { waitMs: timing.summonMs, action: { type: 'PROGRAM_RECEIVED', program, cached: true } },
    // let the lines finish streaming before the run output lands
    { waitMs: program.lines.length * timing.lineMs + 200, action: { type: 'COBOL_RUN_DONE', run: cobolRun } },
    { waitMs: timing.narrateMs, action: { type: 'NARRATE_DONE', steps: narration.steps, python: narration.python, note: narration.note } },
    { waitMs: timing.pythonMs, action: { type: 'PYTHON_RUN_DONE', run: pythonRun } },
    { waitMs: timing.agreeMs, action: { type: 'AGREE' } },
  ]
}

/** Data rows in a CSV (header and trailing blank lines not counted). */
function dataRows(text: string): number {
  return text.replace(/\r\n?/g, '\n').split('\n').slice(1).filter(l => l.trim() !== '').length
}
