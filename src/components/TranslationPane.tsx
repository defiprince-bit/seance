/**
 * TranslationPane — Python translation with intersect-based linked highlighting.
 */
import type { PyLine } from '../lib/schemas.ts'
import type { Range } from '../lib/ranges.ts'
import { intersects } from '../lib/ranges.ts'
import s from './TranslationPane.module.css'

interface TranslationPaneProps {
  lines: PyLine[]
  activeRange: Range | null
  note?: string
}

export function TranslationPane({ lines, activeRange, note }: TranslationPaneProps) {
  return (
    <section className={s.pane} aria-label="Python translation">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}>Brought back</h3>
        <span className={s.meta}>Python 3</span>
      </div>
      <div className={s.py}>
        {lines.map((line, i) => {
          const isOn = activeRange !== null && line.maps !== null
            && intersects(activeRange, line.maps as Range)
          const [ma, mb] = line.maps ?? [0, 0]
          return (
            <span
              key={i}
              className={`${s.ln} ${isOn ? s.on : ''}`}
              data-n={String(i + 1).padStart(2, ' ')}
            >
              {line.text}
              {line.maps && (
                <span className={s.map} aria-hidden="true">↔ {ma}–{mb}</span>
              )}
            </span>
          )
        })}
      </div>
      {note && (
        <div className={s.note}>
          <b>Translator's note.</b> {note}
        </div>
      )}
    </section>
  )
}
