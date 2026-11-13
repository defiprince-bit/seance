/**
 * tests/python.test.ts
 * Tests for src/services/python.ts — the Pyodide worker service layer.
 *
 * The Pyodide runtime itself (WASM) cannot run in Node/Vitest, so the
 * Worker is mocked. These tests exercise the message-passing contract,
 * the 10-second timeout, and error handling in runPython().
 *
 * Requirements: 6.2, 6.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runPython, PYTHON_TIMEOUT_MS } from '../src/services/python.ts'
import type { WorkerLike, WorkerFactory } from '../src/services/python.ts'
import type { WorkerOutMessage } from '../src/services/python.types.ts'

// ---------------------------------------------------------------------------
// MockWorker helpers
// ---------------------------------------------------------------------------

/**
 * Creates a controllable mock worker.
 * The test drives it by calling `worker.fireMessage(msg)` or `worker.fireError(ev)`.
 */
function createMockWorker() {
  const mock = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((ev: MessageEvent) => void) | null,
    onerror: null as ((ev: ErrorEvent) => void) | null,

    /** Simulate a message arriving from the worker. */
    fireMessage(data: WorkerOutMessage) {
      mock.onmessage?.({ data } as MessageEvent<WorkerOutMessage>)
    },

    /** Simulate an uncaught worker error. */
    fireError(message: string) {
      mock.onerror?.({ message } as ErrorEvent)
    },
  }
  return mock
}

type MockWorker = ReturnType<typeof createMockWorker>

function makeFactory(worker: MockWorker): WorkerFactory {
  return () => worker as unknown as WorkerLike
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Successful run
// ---------------------------------------------------------------------------

describe('runPython – successful run', () => {
  it('returns stdout and exitCode 0 from a result message', async () => {
    const worker = createMockWorker()
    const promise = runPython('print("TOTAL: 5871.50")', '', makeFactory(worker))

    worker.fireMessage({ type: 'result', stdout: 'TOTAL: 5871.50', stderr: '', exitCode: 0 })

    const run = await promise
    expect(run.stdout).toBe('TOTAL: 5871.50')
    expect(run.exitCode).toBe(0)
    expect(run.runner).toBe('pyodide')
    expect(run.timedOut).toBeUndefined()
  })

  it('omits stderr from Run when the worker sends an empty string', async () => {
    const worker = createMockWorker()
    const promise = runPython('print("hi")', '', makeFactory(worker))
    worker.fireMessage({ type: 'result', stdout: 'hi', stderr: '', exitCode: 0 })

    const run = await promise
    expect(run.stderr).toBeUndefined()
  })

  it('includes stderr in Run when worker sends non-empty stderr', async () => {
    const worker = createMockWorker()
    const promise = runPython('import sys; sys.stderr.write("warn")', '', makeFactory(worker))
    worker.fireMessage({ type: 'result', stdout: '', stderr: 'warn', exitCode: 0 })

    const run = await promise
    expect(run.stderr).toBe('warn')
  })

  it('sends the code and stdin to the worker via postMessage', async () => {
    const worker = createMockWorker()
    const promise = runPython('print("x")', 'my-stdin', makeFactory(worker))
    worker.fireMessage({ type: 'result', stdout: 'x', stderr: '', exitCode: 0 })

    await promise
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'run',
      code: 'print("x")',
      stdin: 'my-stdin',
    })
  })

  it('terminates the worker after a successful result', async () => {
    const worker = createMockWorker()
    const promise = runPython('', '', makeFactory(worker))
    worker.fireMessage({ type: 'result', stdout: '', stderr: '', exitCode: 0 })

    await promise
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Runtime error (Python exception)
// ---------------------------------------------------------------------------

describe('runPython – runtime error', () => {
  it('returns exitCode 1 when the worker reports a Python exception', async () => {
    const worker = createMockWorker()
    const promise = runPython('raise ValueError("bad")', '', makeFactory(worker))
    worker.fireMessage({
      type: 'result',
      stdout: '',
      stderr: 'ValueError: bad',
      exitCode: 1,
    })

    const run = await promise
    expect(run.exitCode).toBe(1)
    expect(run.stderr).toContain('ValueError')
    expect(run.runner).toBe('pyodide')
  })

  it('handles a worker error message (type: "error")', async () => {
    const worker = createMockWorker()
    const promise = runPython('', '', makeFactory(worker))
    worker.fireMessage({ type: 'error', message: 'Worker crashed unexpectedly' })

    const run = await promise
    expect(run.exitCode).toBe(1)
    expect(run.stderr).toContain('Worker crashed')
  })

  it('handles an onerror event from the worker', async () => {
    const worker = createMockWorker()
    const promise = runPython('', '', makeFactory(worker))
    worker.fireError('Uncaught ReferenceError in worker')

    const run = await promise
    expect(run.exitCode).toBe(1)
    expect(run.stderr).toContain('Uncaught ReferenceError')
  })
})

// ---------------------------------------------------------------------------
// 10-second timeout (Req 6.4)
// ---------------------------------------------------------------------------

describe('runPython – timeout', () => {
  it('returns timedOut: true and terminates the worker after 10 s', async () => {
    const worker = createMockWorker()
    const promise = runPython('while True: pass', '', makeFactory(worker))

    // Advance time past the timeout
    vi.advanceTimersByTime(PYTHON_TIMEOUT_MS + 1)
    const run = await promise

    expect(run.timedOut).toBe(true)
    expect(run.exitCode).toBe(1)
    expect(run.runner).toBe('pyodide')
    expect(run.stderr).toContain('timed out')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('does NOT time out if the worker replies before 10 s', async () => {
    const worker = createMockWorker()
    const promise = runPython('print("fast")', '', makeFactory(worker))

    // Reply well within the timeout
    vi.advanceTimersByTime(PYTHON_TIMEOUT_MS - 1000)
    worker.fireMessage({ type: 'result', stdout: 'fast', stderr: '', exitCode: 0 })

    const run = await promise
    expect(run.timedOut).toBeUndefined()
    expect(run.stdout).toBe('fast')
  })

  it('ignores late messages after the timeout fires', async () => {
    const worker = createMockWorker()
    const promise = runPython('slow', '', makeFactory(worker))

    // First advance past timeout — this resolves the promise
    vi.advanceTimersByTime(PYTHON_TIMEOUT_MS + 1)
    const run = await promise
    expect(run.timedOut).toBe(true)

    // Simulate a late message arriving after termination
    // This should not throw or re-resolve
    expect(() =>
      worker.fireMessage({ type: 'result', stdout: 'late', stderr: '', exitCode: 0 }),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// worker message types  (python.types.ts)
// ---------------------------------------------------------------------------

describe('WorkerOutMessage discriminated union', () => {
  it('result message has the right shape', () => {
    const msg: WorkerOutMessage = { type: 'result', stdout: 'x', stderr: '', exitCode: 0 }
    expect(msg.type).toBe('result')
  })

  it('error message has the right shape', () => {
    const msg: WorkerOutMessage = { type: 'error', message: 'boom' }
    expect(msg.type).toBe('error')
  })
})
