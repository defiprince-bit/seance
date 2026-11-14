/**
 * src/lib/copy.ts
 * Copy that must stay word-for-word (Req 11.3) and the canonical routes.
 */

/** Req 11.3: shown on the landing page. */
export const FOOTNOTE =
  'Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production.'

/** Canonical workspace path (Req 11.1). */
export const WORKSPACE_PATH = '/seance'

/** True when the pathname is the workspace route (`/seance`, `/seance/`, `/seance/...`). */
export function isWorkspacePath(pathname: string): boolean {
  return pathname === WORKSPACE_PATH || pathname.startsWith(WORKSPACE_PATH + '/')
}
