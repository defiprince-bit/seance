/**
 * CodePane — CRT-surface COBOL viewer. The Planchette glides to the first line
 * of the active range; a candle bracket spans the whole range. Both move with
 * CSS transforms (--d-glide, --ease-glide), so reduced motion just jumps.
 */
import { useRef, useEffect } from 'react'
import type { Range } from '../lib/ranges.ts'
import { firstLine } from '../lib/ranges.ts'
import s from './CodePane.module.css'

const LINE_HEIGHT = 19 // 13px / 19px code
const TOP_PAD = 10     // .codewrap padding-top

interface CodePaneProps {
  lines: string[]
  activeRange: Range | null
  streaming: boolean
  filename?: string
  /** compile error: line to mark and token to underline */
  errorAt?: { line: number; token?: string }
  /** a golden séance is replaying (Req 2.3) */
  cached?: boolean
}

const Mark = () => (
  <svg viewBox="0 0 32 32" fill="none" width={14} height={14} aria-hidden="true">
    <path d="M16 2.8c3.4 0 12.6 14.6 12.6 20.6 0 4.3-5.4 5.8-12.6 5.8S3.4 27.7 3.4 23.4C3.4 17.4 12.6 2.8 16 2.8Z" stroke="#E9A957" strokeWidth="1.6" strokeLinejoin="round"/>
    <circle cx="16" cy="18" r="5.4" stroke="#E9A957" strokeWidth="1.6"/>
    <rect x="14.6" y="15.6" width="2.8" height="4.8" rx=".4" fill="#9FDDB0"/>
  </svg>
)

/** The error line, with the failing token under a wavy danger underline. */
function Marked({ text, token }: { text: string; token?: string }) {
  const at = token ? text.toUpperCase().indexOf(token.toUpperCase()) : -1
  if (at < 0) return <>{text || ' '}</>
  return <>{text.slice(0, at)}<span className={s.token}>{text.slice(at, at + token!.length)}</span>{text.slice(at + token!.length)}</>
}

export function CodePane({ lines, activeRange: stepRange, streaming, filename, errorAt, cached }: CodePaneProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  // a compile error takes over the highlight: the planchette points at the broken line
  const activeRange: Range | null = errorAt ? [errorAt.line, errorAt.line] : stepRange
  const a = activeRange ? activeRange[0] : 0
  const b = activeRange ? activeRange[1] : 0

  // Scroll the range to about 30% from the top (Req 5.3)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || a === 0) return
    const top = TOP_PAD + (a - 1) * LINE_HEIGHT
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    wrap.scrollTo({ top: Math.max(0, top - wrap.clientHeight * 0.3), behavior: reduce ? 'auto' : 'smooth' })
  }, [a, b])

  // .code already sits inside .codewrap's padding, so offsets start at 0
  const planchetteY = activeRange ? (firstLine(activeRange) - 1) * LINE_HEIGHT : 0
  const bracketH = (b - a + 1) * LINE_HEIGHT

  return (
    <section className={s.pane} aria-label="COBOL program">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}>COBOL</h3>
        {filename && <span className={s.meta}>{filename} · {lines.length} lines{cached ? ' · cached séance' : ''}</span>}
      </div>
      <div className={`${s.codewrap} crt`} ref={wrapRef}>
        <div className={s.code}>
          {activeRange && (
            <>
              <div className={s.planchette} aria-hidden="true" style={{ transform: `translateY(${planchetteY}px)` }}>
                <Mark />
              </div>
              <div className={s.bracket} aria-hidden="true" style={{ transform: `translateY(${planchetteY}px)`, height: `${bracketH}px` }} />
            </>
          )}
          {lines.map((line, i) => {
            const n = i + 1
            const on = activeRange !== null && n >= a && n <= b
            const done = activeRange !== null && n < a
            const isErr = errorAt?.line === n
            return (
              <span
                key={i}
                className={`${s.ln} ${on ? s.on : ''} ${done ? s.done : ''} ${isErr ? s.err : ''} ${streaming ? s.streaming : ''}`}
                data-n={n}
                style={streaming ? { animationDelay: `${i * 40}ms` } : undefined}
                aria-invalid={isErr || undefined}
              >
                {isErr ? <Marked text={line} token={errorAt?.token} /> : (line || ' ')}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}
