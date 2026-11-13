/**
 * src/lib/retry.ts
 * One quiet retry for transient network failures ("fetch failed" in Node,
 * "Failed to fetch" in browsers). HTTP errors are NOT retried here: the caller
 * only gets a rejected promise from fetch when the request never got a
 * response. Pure apart from a timer, so it is safe in src/lib.
 */

/** fetch() rejects with a TypeError when the network fails; aborts are DOMExceptions. */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  return !/abort/i.test(err.message)
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
    const onAbort = () => { clearTimeout(t); reject(abortError()) }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function abortError(): Error {
  const e = new Error('The operation was aborted.')
  e.name = 'AbortError'
  return e
}

export interface RetryOptions {
  /** extra attempts after the first (default 1) */
  retries?: number
  /** wait before each retry, in ms (default 400) */
  delayMs?: number
  signal?: AbortSignal
}

/**
 * Runs `attempt`, retrying only when it rejects with a network error.
 * Aborts stop immediately, including during the backoff wait.
 */
export async function withNetworkRetry<T>(
  attempt: () => Promise<T>,
  { retries = 1, delayMs = 400, signal }: RetryOptions = {},
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt()
    } catch (err) {
      if (isAbort(err) || !isNetworkError(err) || i >= retries) throw err
      await sleep(delayMs * (i + 1), signal)
    }
  }
}
