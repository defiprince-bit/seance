/**
 * src/lib/layout.ts
 * Breakpoints and pane visibility for the workspace (Req 10.1), per
 * seance-design.md "Layout and breakpoints" and design/shots/:
 *   ≥1200  desktop  3 columns, no tabs (unchanged)
 *   768–1199 tablet code always visible + one right panel by tab (Ghost default)
 *   <768   mobile   one panel by tab (Code default), GhostCaption on Code
 * Pure: the media queries live here; src/state/useMedia.ts evaluates them.
 */

export type Layout = 'desktop' | 'tablet' | 'mobile'
export type PaneTab = 'code' | 'ghost' | 'python' | 'output'
export type PipelineStepName = 'summon' | 'run' | 'narrate' | 'python'

export const MOBILE_QUERY = '(max-width: 767px)'
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1199px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function layoutFrom(m: { mobile: boolean; tablet: boolean }): Layout {
  return m.mobile ? 'mobile' : m.tablet ? 'tablet' : 'desktop'
}

export const TABS: Record<Layout, readonly PaneTab[]> = {
  desktop: [],
  tablet: ['ghost', 'python', 'output'],
  mobile: ['code', 'ghost', 'python', 'output'],
}

export const TAB_LABELS: Record<PaneTab, string> = { code: 'Code', ghost: 'Ghost', python: 'Python', output: 'Output' }

/** The tab in force: the chosen one if this layout has it, else the layout's default. */
export function effectiveTab(layout: Layout, chosen?: PaneTab): PaneTab | undefined {
  const tabs = TABS[layout]
  if (tabs.length === 0) return undefined
  return chosen && tabs.includes(chosen) ? chosen : tabs[0]
}

export interface Visible { code: boolean; ghost: boolean; python: boolean; output: boolean }

export function visiblePanes(layout: Layout, tab: PaneTab | undefined): Visible {
  if (layout === 'desktop') return { code: true, ghost: true, python: true, output: true }
  const t = effectiveTab(layout, tab)
  return {
    code: layout === 'tablet' || t === 'code',
    ghost: t === 'ghost',
    python: t === 'python',
    output: t === 'output',
  }
}

/** Where a failure is explained: Python failures in the output pane, all others in the ghost pane. */
export function tabForFailure(step: PipelineStepName): PaneTab {
  return step === 'python' ? 'output' : 'ghost'
}
