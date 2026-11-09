/**
 * src/lib/lineOffset.ts
 * Remaps compiler line-number references in error messages.
 *
 * The OnlineCompiler.io runner prepends ">>SOURCE FORMAT IS FIXED" as line 1,
 * so the compiler's line numbers are 1 higher than the user's source lines.
 * This module strips that offset before the Run response is returned, so the
 * UI always sees line numbers that match Program.lines[lineNumber - 1].
 */

/**
 * Applies a line-number offset to every bare integer that looks like a
 * compiler line reference in a message string.
 *
 * Strategy: find patterns like "line N", "LINE N", ":N:", "at N" where N
 * is a positive integer, and subtract `offset` from N (clamping to 1).
 *
 * @param message  Raw compiler error message from the runner.
 * @param offset   Number to subtract (typically 1 for the directive line).
 * @returns  The message with adjusted line numbers.
 */
export function remapCompilerMessage(message: string, offset: number): string {
  if (offset === 0) return message

  // Patterns: "line 42", "LINE 42", ":42:", "at line 42"
  // We capture the number and subtract the offset.
  return message.replace(
    /\b(line\s+|LINE\s+|:)(\d+)(\b|:)/gi,
    (_match, prefix: string, numStr: string, suffix: string) => {
      const adjusted = Math.max(1, parseInt(numStr, 10) - offset)
      return `${prefix}${adjusted}${suffix}`
    },
  )
}
