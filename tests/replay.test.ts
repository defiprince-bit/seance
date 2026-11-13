/**
 * tests/replay.test.ts  (task 10.2)
 * A chip replay dispatches the same actions a live séance does, in order and on
 * a timer, ending in the agreement bar with the "cached séance" flag set.
 */
import { describe, it, expect } from 'vitest'
import { replayPlan, DEFAULT_TIMING } from '../src/state/replay.ts'
import { reducer, initial, pillStatus } from '../src/state/seance.ts'
import type { SeanceState } from '../src/state/seance.ts'
import { goldenFor } from '../src/services/golden.ts'

const golden = goldenFor('sales')!

describe('replayPlan', () => {
  const plan = replayPlan(golden)

  it('plays the live pipeline in order', () => {
    expect(plan.map(s => s.action.type)).toEqual([
      'SET_CSV', 'SUMMON_START', 'PROGRAM_RECEIVED', 'COBOL_RUN_DONE', 'NARRATE_DONE', 'PYTHON_RUN_DONE', 'AGREE',
    ])
  })

  it('marks the program as cached and waits for the lines to stream in', () => {
    expect(plan[2].action).toMatchObject({ type: 'PROGRAM_RECEIVED', cached: true })
    expect(plan[2].waitMs).toBe(DEFAULT_TIMING.summonMs) // the skeleton shows first
    expect(plan[3].waitMs).toBeGreaterThanOrEqual(golden.program.lines.length * DEFAULT_TIMING.lineMs)
  })

  it('takes a few seconds in total, like a quick live séance', () => {
    const total = plan.reduce((t, s) => t + s.waitMs, 0)
    expect(total).toBeGreaterThan(2000)
    expect(total).toBeLessThan(6000)
  })

  it('every intermediate state is one the UI can show', () => {
    const states: SeanceState[] = []
    plan.reduce((s, step) => { const next = reducer(s, step.action); states.push(next); return next }, initial)
    expect(states[1].phase).toBe('summoning')   // skeleton
    expect(states[2].phase).toBe('running')     // code streams in
    expect(states[4].steps.length).toBeGreaterThan(0) // narration + planchette
    expect(states.every(s => s.error === undefined)).toBe(true)
  })

  it('ends ready, cached, with both runs and a matching agreement bar', () => {
    const end = plan.reduce((s, step) => reducer(s, step.action), initial)
    expect(end.phase).toBe('ready')
    expect(end.cached).toBe(true)
    expect(end.cobolRun?.stdout).toBe(golden.cobolRun.stdout)
    expect(end.pythonRun?.stdout).toBe(golden.pythonRun.stdout)
    expect(end.agreement).toMatchObject({ status: 'match', label: 'TOTAL SALES' })
    expect(end.csv).toMatchObject({ name: 'sales.csv', rows: 4 })
    expect(pillStatus(end)).toEqual({ tone: 'present', label: 'Spirit present' })
  })

  it('a later live summon clears the cached flag', () => {
    const end = plan.reduce((s, step) => reducer(s, step.action), initial)
    const live = reducer(reducer(end, { type: 'SUMMON_START' }), { type: 'PROGRAM_RECEIVED', program: golden.program })
    expect(live.cached).toBe(false)
  })

  it('custom timing (e.g. instant) keeps the order', () => {
    const instant = replayPlan(golden, { summonMs: 0, lineMs: 0, narrateMs: 0, pythonMs: 0, agreeMs: 0 })
    expect(instant.map(s => s.action.type)).toEqual(plan.map(s => s.action.type))
  })
})
