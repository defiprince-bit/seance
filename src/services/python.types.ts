/**
 * src/services/python.types.ts
 * Shared message types between the Pyodide worker and python.ts.
 * Kept in src/services/ so the service can import them without importing
 * the worker module itself (which would trigger Vite's worker bundling).
 */

export interface WorkerRunMessage {
  type: 'run'
  code: string
  stdin: string
}

export interface WorkerResultMessage {
  type: 'result'
  stdout: string
  stderr: string
  exitCode: number
}

export interface WorkerErrorMessage {
  type: 'error'
  message: string
}

export type WorkerOutMessage = WorkerResultMessage | WorkerErrorMessage
