/**
 * tests/seance.reducer.test.ts
 * Reducer transitions for the empty, summoning, error and busy states, and the
 * StatusPill label for each. Validates: Requirements 2.1, 3.5, 3.6, 4.4, 4.5, 6.4, 8.2
 */
import { describe, it, expect } from 'vitest'
import { reducer, initial, pillStatus } from '../src/state/seance.ts'
import type { SeanceState, Action } from '../src/state/seance.ts'
import type { Program, Run } from '../src/lib/schemas.ts'

const program: Program = {
  language: 'cobol', dialect: 'cobol85-fixed', filename: 'x.cob', title: 'X',
  lines: ['       IDENTIFICATION DIVISION.', '       PROCEDURE DIVISION.', '           STOP RUN.'],
}
const ok = (stdout: string, runner: Run['runner'] = 'onlinecompiler'): Run => ({ stdout, exitCode: 0, runner })

const run = (...actions: Action[]) => actions.reduce(reducer, initial)
const started = (): SeanceState => run({ type: 'SET_TASK', task: 'Total sales' }, { type: 'SUMMON_START' }, { type: 'PROGRAM_RECEIVED', program })

describe('happy path and the pill', () => {
  it('idle → summoning → present → ready', () => {
    expect(pillStatus(initial)).toEqual({ tone: 'idle', label: 'Candles lit' })
    expect(pillStatus(run({ type: 'SUMMON_START' }))).toEqual({ tone: 'summoning', label: 'Summoning' })
    const done = run(
      { type: 'SUMMON_START' }, { type: 'PROGRAM_RECEIVED', program },
      { type: 'COBOL_RUN_DONE', run: ok('TOTAL: 1.00\n') },
      { type: 'NARRATE_DONE', steps: [{ range: [1, 3], text: 'x' }], python: [{ text: 'print()', maps: null }] },
      { type: 'PYTHON_RUN_DONE', run: ok('TOTAL: 1.00', 'pyodide') },
      { type: 'AGREE' },
    )
    expect(done.phase).toBe('ready')
    expect(done.agreement?.status).toBe('match')
    expect(pillStatus(done)).toEqual({ tone: 'present', label: 'Spirit present' })
  })
})

describe('summon failures', () => {
  it('busy (429/5xx) → busy error on the summon step, old program cleared', () => {
    const s = reducer(started(), { type: 'STEP_FAILED', step: 'summon', kind: 'busy', message: 'Server returned 429' })
    expect(s.phase).toBe('error')
    expect(s.error).toMatchObject({ kind: 'busy', step: 'summon' })
    expect(s.program).toBeUndefined()
    expect(s.task).toBe('Total sales')
    expect(pillStatus(s)).toEqual({ tone: 'error', label: 'Spirits busy' })
  })

  it('invalid JSON after the API retry → "ghost mumbled"', () => {
    const s = run({ type: 'SUMMON_START' }, { type: 'STEP_FAILED', step: 'summon', kind: 'invalid', message: 'The ghost mumbled.' })
    expect(s.error).toMatchObject({ kind: 'invalid', step: 'summon' })
    expect(pillStatus(s).label).toBe('Ghost mumbled')
  })

  it('unsupported task → unsupported error, nothing else runs (Req 3.5)', () => {
    const s = reducer(started(), { type: 'SUMMON_UNSUPPORTED', reason: 'COBOL cannot open a webcam.' })
    expect(s.error).toEqual({ kind: 'unsupported', step: 'summon', message: 'COBOL cannot open a webcam.' })
    expect(s.program).toBeUndefined()
    expect(s.cobolRun).toBeUndefined()
  })
})

describe('COBOL run failures', () => {
  it('compile error → compile kind with the line, pill "Didn\'t compile" (Req 4.4)', () => {
    const s = reducer(started(), {
      type: 'COBOL_RUN_DONE',
      run: { stdout: '', exitCode: 1, runner: 'onlinecompiler', compileError: { line: 2, message: "code.cob:2: error: 'X' is not defined" } },
    })
    expect(s.error).toMatchObject({ kind: 'compile', step: 'run', line: 2 })
    expect(s.cobolRun).toBeDefined()
    expect(pillStatus(s)).toEqual({ tone: 'error', label: "Didn't compile" })
  })

  it('timeout → timeout kind carrying the runner\'s limit (Req 4.5)', () => {
    const s = reducer(started(), { type: 'COBOL_RUN_DONE', run: { stdout: '', exitCode: 124, timedOut: true, timeLimitSec: 30, runner: 'onlinecompiler' } })
    expect(s.error).toMatchObject({ kind: 'timeout', step: 'run', seconds: 30 })
    expect(pillStatus(s).label).toBe('Run failed')
  })

  it('runtime error → runtime kind with stderr', () => {
    const s = reducer(started(), { type: 'COBOL_RUN_DONE', run: { stdout: '', stderr: 'divide by zero', exitCode: 1, runner: 'onlinecompiler' } })
    expect(s.error).toMatchObject({ kind: 'runtime', step: 'run', message: 'divide by zero' })
  })

  it('a runtime error with no stderr still says something', () => {
    const s = reducer(started(), { type: 'COBOL_RUN_DONE', run: { stdout: '', exitCode: 3, runner: 'onlinecompiler' } })
    expect(s.error?.message).toBe('Exited with code 3.')
  })
})

describe('parallel branch and Python', () => {
  it('the first failure wins: a later narrate failure does not overwrite a compile error', () => {
    const s = run(
      { type: 'SUMMON_START' }, { type: 'PROGRAM_RECEIVED', program },
      { type: 'COBOL_RUN_DONE', run: { stdout: '', exitCode: 1, runner: 'onlinecompiler', compileError: { line: 1, message: 'm' } } },
      { type: 'STEP_FAILED', step: 'narrate', kind: 'busy', message: 'Server returned 503' },
    )
    expect(s.error?.kind).toBe('compile')
  })

  it('narrate failure while the run succeeds → invalid error on narrate, program kept', () => {
    const s = reducer(started(), { type: 'STEP_FAILED', step: 'narrate', kind: 'invalid', message: 'The ghost mumbled.' })
    expect(s.error).toMatchObject({ kind: 'invalid', step: 'narrate' })
    expect(s.program).toBe(program)
  })

  it('narration that arrives after an error is kept but the phase stays error', () => {
    const failed = reducer(started(), { type: 'COBOL_RUN_DONE', run: { stdout: '', exitCode: 1, runner: 'onlinecompiler' } })
    const s = reducer(failed, { type: 'NARRATE_DONE', steps: [{ range: [1, 1], text: 'x' }], python: [] })
    expect(s.phase).toBe('error')
    expect(s.steps).toHaveLength(1)
  })

  it('Python exception → runtime error on the python step (Req 6.4)', () => {
    const s = reducer(started(), { type: 'PYTHON_RUN_DONE', run: { stdout: '', stderr: 'ZeroDivisionError', exitCode: 1, runner: 'pyodide' } })
    expect(s.error).toMatchObject({ kind: 'runtime', step: 'python', message: 'ZeroDivisionError' })
    expect(s.pythonRun).toBeDefined()
  })

  it('Python over 10 s → timeout on the python step', () => {
    const s = reducer(started(), { type: 'PYTHON_RUN_DONE', run: { stdout: '', exitCode: 1, timedOut: true, timeLimitSec: 10, runner: 'pyodide' } })
    expect(s.error).toMatchObject({ kind: 'timeout', step: 'python', seconds: 10 })
  })

  it('AGREE does nothing after a failure', () => {
    const failed = reducer(started(), { type: 'PYTHON_RUN_DONE', run: { stdout: '', exitCode: 1, runner: 'pyodide' } })
    expect(reducer(failed, { type: 'AGREE' })).toBe(failed)
  })
})

describe('recovering', () => {
  it('a new program clears the previous error', () => {
    const failed = reducer(started(), { type: 'STEP_FAILED', step: 'narrate', kind: 'busy', message: 'x' })
    const s = reducer(reducer(failed, { type: 'SUMMON_START' }), { type: 'PROGRAM_RECEIVED', program })
    expect(s.error).toBeUndefined()
    expect(s.phase).toBe('running')
  })

  it('Esc restores the state from before the summon, keeping the typed task (Req 3.6)', () => {
    const before = reducer(started(), { type: 'STEP_FAILED', step: 'run', kind: 'busy', message: 'x' })
    const summoning = reducer(reducer(before, { type: 'SET_TASK', task: 'new task' }), { type: 'SUMMON_START' })
    const s = reducer(summoning, { type: 'RESTORE', snapshot: before })
    expect(s.error).toEqual(before.error)
    expect(s.phase).toBe('error')
    expect(s.task).toBe('new task')
  })

  it('End séance resets to the empty state', () => {
    expect(reducer(started(), { type: 'RESET' })).toEqual(initial)
  })
})
