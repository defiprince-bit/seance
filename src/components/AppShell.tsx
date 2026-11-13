/**
 * AppShell — full-height frame: top bar, task row, then the 3-column grid
 * (code | ghost | python over output). Tablet and mobile layouts are task 13.
 */
import type { ReactNode } from 'react'
import s from './AppShell.module.css'

interface AppShellProps {
  top: ReactNode
  task: ReactNode
  code: ReactNode
  ghost: ReactNode
  python: ReactNode
}

export function AppShell({ top, task, code, ghost, python }: AppShellProps) {
  return (
    <div className={s.app}>
      {top}
      {task}
      <main className={s.grid}>
        <div className={s.col}>{code}</div>
        <div className={s.col}>{ghost}</div>
        <div className={s.col}>{python}</div>
      </main>
    </div>
  )
}
