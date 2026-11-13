/**
 * src/workers/pyodide.worker.ts
 * Web Worker that loads Pyodide and runs the Python translation.
 *
 * Pinned version: Pyodide v314.0.7
 * CDN: https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs
 *
 * Message protocol:
 *   Incoming (from python.ts):
 *     { type: 'run'; code: string; stdin: string }
 *
 *   Outgoing (to python.ts):
 *     { type: 'result'; stdout: string; stderr: string; exitCode: number }
 *   | { type: 'error';  message: string }
 *
 * Timeout: enforced by the *caller* (python.ts) which calls worker.terminate()
 * after 10 s. The worker itself does not set a timer — termination from outside
 * is the correct Web Worker pattern for this.
 *
 * Requirements: 6.2, 6.4
 */

// ---------------------------------------------------------------------------
// Types (shared with src/services/python.ts via python.types.ts)
// ---------------------------------------------------------------------------

export type { WorkerRunMessage, WorkerResultMessage, WorkerErrorMessage, WorkerOutMessage } from '../services/python.types.ts'

import type { WorkerRunMessage, WorkerResultMessage } from '../services/python.types.ts'

// ---------------------------------------------------------------------------
// Pyodide loader (module-level singleton so repeated runs skip re-download)
// ---------------------------------------------------------------------------

// Pyodide v314.0.7 — pinned per task spec (see pyodide.org/en/stable)
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance

  // Dynamic import works in module workers (Vite emits type:"module" workers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { loadPyodide } = (await import(/* @vite-ignore */ PYODIDE_CDN)) as any
  pyodideInstance = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/' })
  return pyodideInstance
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<WorkerRunMessage>) => {
  if (event.data?.type !== 'run') return

  const { code, stdin } = event.data

  try {
    const pyodide = await getPyodide()

    // Capture stdout and stderr
    let stdout = ''
    let stderr = ''

    pyodide.setStdout({ batched: (text: string) => { stdout += text + '\n' } })
    pyodide.setStderr({ batched: (text: string) => { stderr += text + '\n' } })

    // Redirect stdin: provide stdin lines one at a time via sys.stdin
    // Keep blank rows: the protocol's count line must match the rows fed in.
    // Only the empty string after the final '\n' is dropped.
    const stdinLines = stdin.replace(/\r\n?/g, '\n').split('\n')
    if (stdinLines.length > 0 && stdinLines[stdinLines.length - 1] === '') stdinLines.pop()
    let stdinIndex = 0
    pyodide.setStdin({
      stdin: () => {
        if (stdinIndex < stdinLines.length) {
          return stdinLines[stdinIndex++] + '\n'
        }
        return null // EOF
      },
    })

    // Run the code
    await pyodide.runPythonAsync(code)

    const result: WorkerResultMessage = {
      type: 'result',
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      exitCode: 0,
    }
    self.postMessage(result)
  } catch (err: unknown) {
    // Python exceptions surface here — report as runtime error (exitCode 1)
    const message = err instanceof Error ? err.message : String(err)

    // Check if this was a SystemExit (Python sys.exit())
    const exitMatch = /SystemExit:\s*(\d+)/.exec(message)
    const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 1

    const result: WorkerResultMessage = {
      type: 'result',
      stdout: '',
      stderr: message,
      exitCode,
    }
    self.postMessage(result)
  }
}
