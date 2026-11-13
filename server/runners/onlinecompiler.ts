/**
 * server/runners/onlinecompiler.ts
 * Runner adapter for OnlineCompiler.io (gnucobol-3.2).
 *
 * Protocol:
 *  - POST https://api.onlinecompiler.io/api/run-code-sync/
 *  - Auth: Authorization: <key>  (no "Bearer " prefix)
 *  - Request: { compiler, code, input }
 *  - Response: { output, error, exit_code, status, signal, time, time_limit, ... }
 *
 * Source-format rule (tech.md):
 *  The runner prepends ">>SOURCE FORMAT IS FIXED\n" as line 1 before sending,
 *  so every compiler line number is 1 higher than the user's source. We use
 *  remapCompilerMessage(..., 1) to subtract that offset before returning.
 *
 * Timeout:
 *  OnlineCompiler.io sets exit_code = 124 when the time limit is exceeded.
 */

import { remapCompilerMessage, firstErrorLine } from '../../src/lib/lineOffset.js'
import { withNetworkRetry } from '../../src/lib/retry.js'
import type { Run } from '../../src/lib/schemas.js'

// ---------------------------------------------------------------------------
// Types for the OnlineCompiler.io wire format
// ---------------------------------------------------------------------------

interface OcRequest {
  compiler: 'gnucobol-3.2'
  code: string
  input: string
  time_limit?: number
}

interface OcResponse {
  output: string
  error: string
  status: 'success' | 'error'
  exit_code: number
  signal: number | null
  truncated: boolean
  time: string
  total: string
  memory: string
  time_limit: number
  memory_limit: number
}

// ---------------------------------------------------------------------------
// compile-error detection
// ---------------------------------------------------------------------------

/**
 * GnuCOBOL 3.2 compile errors look like:
 *   program.cob:5: Error: ...
 *   program.cob:5:12: Error: ...
 * We detect them by checking for the pattern ":<number>:" or ":<number>:" in
 * the error field when exit_code is non-zero and output is empty (the program
 * never ran).
 */
function parseCompileError(
  errorText: string,
  lineOffset: number,
): { line?: number; message: string } | null {
  if (!errorText.trim()) return null

  const message = remapCompilerMessage(errorText.trim(), lineOffset)
  // first "file:N: error:" diagnostic (notes and warnings are skipped)
  const line = firstErrorLine(message)
  return line === undefined ? { message } : { line, message }
}

// ---------------------------------------------------------------------------
// runCobol
// ---------------------------------------------------------------------------

const OC_ENDPOINT = 'https://api.onlinecompiler.io/api/run-code-sync/'
/** Line offset introduced by prepending the >>SOURCE FORMAT directive. */
const DIRECTIVE_LINE_OFFSET = 1

/**
 * Compiles and runs a COBOL program on OnlineCompiler.io.
 *
 * @param source   The user's COBOL source (without the FORMAT directive).
 * @param stdin    Encoded stdin string (from encodeStdin).
 * @param apiKey   ONLINECOMPILER_API_KEY from environment.
 * @returns        A Run object with line numbers adjusted to match the user's source.
 * @throws         On network errors or non-2xx HTTP responses (caller handles fallback).
 */
export async function runCobol(source: string, stdin: string, apiKey: string): Promise<Run> {
  // Prepend the fixed-format directive. The compiler sees this as line 1;
  // all user source lines shift by +1, which we subtract on the way out.
  const code = `>>SOURCE FORMAT IS FIXED\n${source}`

  const body: OcRequest = {
    compiler: 'gnucobol-3.2',
    code,
    input: stdin,
  }

  // one quiet retry if the request never got a response ("fetch failed")
  const response = await withNetworkRetry(() => fetch(OC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }))

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`OnlineCompiler.io returned ${response.status}: ${text}`)
  }

  const oc = (await response.json()) as OcResponse

  // Timeout: exit_code 124 means the run hit the time limit
  if (oc.exit_code === 124) {
    return {
      stdout: oc.output,
      stderr: oc.error || undefined,
      exitCode: 124,
      timedOut: true,
      ...(typeof oc.time_limit === 'number' ? { timeLimitSec: oc.time_limit } : {}),
      runner: 'onlinecompiler',
    }
  }

  // Compile error: non-zero exit AND output is empty AND error has content.
  // GnuCOBOL exits non-zero when compilation fails; the program never runs
  // so stdout is empty.
  if (oc.exit_code !== 0 && oc.output === '' && oc.error) {
    const compileError = parseCompileError(oc.error, DIRECTIVE_LINE_OFFSET)
    if (compileError) {
      return {
        stdout: '',
        stderr: oc.error,
        exitCode: oc.exit_code,
        compileError,
        runner: 'onlinecompiler',
      }
    }
  }

  // Runtime error or success
  return {
    stdout: oc.output,
    stderr: oc.error || undefined,
    exitCode: oc.exit_code,
    runner: 'onlinecompiler',
  }
}
