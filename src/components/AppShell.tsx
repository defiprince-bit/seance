/**
 * AppShell — full-height frame: top bar, task row, panel tabs (tablet and
 * mobile only), the grid, and the docked GhostCaption (mobile Code tab).
 *   desktop  code | ghost | python over output   (no tabs; unchanged)
 *   tablet   code | one of ghost / python / output
 *   mobile   one of code / ghost / python / output
 * Panes stay mounted and are hidden with the `hidden` attribute, so switching
 * tabs keeps scroll position and run output.
 */
import type { ReactNode } from 'react'
import { TABS, TAB_LABELS, effectiveTab, visiblePanes } from '../lib/layout.ts'
import type { Layout, PaneTab } from '../lib/layout.ts'
import { SegmentedControl } from './SegmentedControl.tsx'
import s from './AppShell.module.css'

const PANEL_ID: Record<PaneTab, string> = { code: 'panel-code', ghost: 'panel-ghost', python: 'panel-python', output: 'panel-output' }

interface AppShellProps {
  top: ReactNode
  task: ReactNode
  code: ReactNode
  ghost: ReactNode
  translation: ReactNode
  output: ReactNode
  layout?: Layout
  tab?: PaneTab
  onTab?: (tab: PaneTab) => void
  caption?: ReactNode
}

export function AppShell({ top, task, code, ghost, translation, output, layout = 'desktop', tab, onTab, caption }: AppShellProps) {
  const current = effectiveTab(layout, tab)
  const vis = visiblePanes(layout, current)
  const tabs = TABS[layout]

  return (
    <div className={s.app} data-layout={layout}>
      {top}
      {task}
      {current && (
        <div className={s.tabs}>
          <SegmentedControl
            label="Panels"
            full={layout === 'mobile'}
            value={current}
            onChange={t => onTab?.(t)}
            options={tabs.map(t => ({ value: t, label: TAB_LABELS[t], controls: PANEL_ID[t] }))}
          />
        </div>
      )}
      <main className={s.grid} data-layout={layout} data-tab={current}>
        <div className={s.col} id={PANEL_ID.code} hidden={!vis.code}>{code}</div>
        <div className={s.col} id={PANEL_ID.ghost} hidden={!vis.ghost}>{ghost}</div>
        <div className={s.col} hidden={!vis.python && !vis.output}>
          <div className={s.slot} id={PANEL_ID.python} hidden={!vis.python}>{translation}</div>
          <div className={`${s.slot} ${s.outSlot}`} id={PANEL_ID.output} hidden={!vis.output}>{output}</div>
        </div>
      </main>
      {caption}
    </div>
  )
}
