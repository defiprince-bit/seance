/**
 * src/services/python.ts
 * Browser-side service that runs Python code through the Pyodide Web Worker.
 *
 * Returns a Run object with runner: 'pyodide'.
 * Enforces a 10-second timeout by terminating the worker (Req 6.4).
 *
 * Usage (browser):
 *   const run = await runPython(pythonCode, stdin)
 *
 * Usage (tests):
 *   const run = await runPython(code, stdin, () => new MockWorker())
 */

import type { Run } from '../lib/schemas.ts'
import type { WorkerOutMessage } from './python.types.ts'

// ---------------------------------------------------------------------------
// WorkerLike interface — lets tests inject a mock
// ---------------------------------------------------------------------------

/** Minimal interface that looks like a Web Worker to this service. */
export interface WorkerLike {
  postMessage(msg: unknown): void
  terminate(): void
  onmessage: ((ev: MessageEvent) => void) | null
  onerror: ((ev: ErrorEvent) => void) | null
}

/** Factory function that creates a WorkerLike. */
export type WorkerFactory = () => WorkerLike

// ---------------------------------------------------------------------------
// Default factory — spawns the real Pyodide worker in the browser
// ---------------------------------------------------------------------------

/**
 * Creates the Pyodide Web Worker using Vite's worker URL syntax.
 * This import is evaluated lazily so the module can be imported in tests
 * without triggering Vite's worker bundling or loading Pyodide.
 */
function createPyodideWorker(): WorkerLike {
  return new Worker(
    new URL('../workers/pyodide.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

// ---------------------------------------------------------------------------
// runPython
// ---------------------------------------------------------------------------

/** Timeout in milliseconds (Req 6.4). */
export const PYTHON_TIMEOUT_MS = 10_000

/**
 * Runs Python code in the Pyodide Web Worker and returns a Run.
 *
 * @param code     The Python source to execute.
 * @param stdin    The stdin string (same encoded form used for COBOL).
 * @param factory  Optional worker factory. Defaults to the Pyodide worker.
 *                 Pass a mock factory in tests.
 */
export async function runPython(
  code: string,
  stdin: string,
  factory: WorkerFactory = createPyodideWorker,
): Promise<Run> {
  const worker = factory()

  return new Promise<Run>((resolve) => {
    let settled = false

    // 10-second hard timeout: terminate the worker and return timedOut: true
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      worker.terminate()
      resolve({
        stdout: '',
        stderr: 'Python run timed out after 10 seconds.',
        exitCode: 1,
        timedOut: true,
        runner: 'pyodide',
      })
    }, PYTHON_TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      worker.terminate()

      const msg = event.data
      if (msg.type === 'result') {
        resolve({
          stdout: msg.stdout,
          // omit stderr from Run if it's empty — matches the Run schema (stderr?: string)
          ...(msg.stderr ? { stderr: msg.stderr } : {}),
          exitCode: msg.exitCode,
          runner: 'pyodide',
        })
      } else {
        // type: 'error' — unexpected worker crash before any result
        resolve({
          stdout: '',
          stderr: msg.message,
          exitCode: 1,
          runner: 'pyodide',
        })
      }
    }

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      worker.terminate()
      resolve({
        stdout: '',
        stderr: event.message ?? 'Worker error',
        exitCode: 1,
        runner: 'pyodide',
      })
    }

    worker.postMessage({ type: 'run', code, stdin })
  })
}
