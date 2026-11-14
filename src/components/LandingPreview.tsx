/**
 * LandingPreview: a static picture of the workspace. The COBOL lines and the
 * 5871.50 result match the golden "Sales total" séance; the ghost's quote,
 * explanation and the mapped Python line are read from that fixture
 * (src/fixtures/golden/sales.json) so the picture can't drift from it.
 */
import { goldenFor } from '../services/golden.ts'
import { intersects } from '../lib/ranges.ts'
import { PlanchetteMark } from './PlanchetteMark.tsx'
import s from './LandingPreview.module.css'

/** The highlighted lines (the UNSTRING statement). */
export const PREVIEW_RANGE: [number, number] = [21, 22]

const SALES = goldenFor('sales')
/** The ghost's step for the highlighted lines: exact range first, else the first overlapping one. */
export const PREVIEW_STEP =
  SALES?.narration.steps.find(st => st.range[0] === PREVIEW_RANGE[0] && st.range[1] === PREVIEW_RANGE[1]) ??
  SALES?.narration.steps.find(st => intersects(st.range, PREVIEW_RANGE))
/** The first Python line mapped to the highlighted lines. */
export const PREVIEW_PY = SALES?.narration.python.find(l => l.maps !== null && intersects(l.maps, PREVIEW_RANGE))

type Tok = string | { kw: string } | { lit: string }
const LINES: { n: number; on?: boolean; toks: Tok[] }[] = [
  { n: 18, toks: [{ kw: 'ACCEPT' }, ' WS-COUNT'] },
  { n: 19, toks: [{ kw: 'PERFORM VARYING' }, ' WS-I ', { kw: 'FROM' }, ' 1 ', { kw: 'BY' }, ' 1'] },
  { n: 20, toks: ['    ', { kw: 'ACCEPT' }, ' WS-LINE'] },
  { n: 21, on: true, toks: ['    ', { kw: 'UNSTRING' }, ' WS-LINE ', { kw: 'DELIMITED BY' }, ' ', { lit: "','" }] },
  { n: 22, on: true, toks: ['      ', { kw: 'INTO' }, ' WS-REGION WS-AMOUNT-TXT'] },
  { n: 23, toks: ['    ', { kw: 'MOVE FUNCTION NUMVAL' }, '(WS-AMOUNT-TXT)'] },
  { n: 24, toks: ['    ', { kw: 'ADD' }, ' WS-AMOUNT ', { kw: 'TO' }, ' WS-TOTAL'] },
  { n: 25, toks: [{ kw: 'END-PERFORM' }, '.'] },
]

function render(t: Tok, i: number) {
  if (typeof t === 'string') return t
  if ('kw' in t) return <span key={i} className={s.kw}>{t.kw}</span>
  return <span key={i} className={s.lit}>{t.lit}</span>
}

export function LandingPreview() {
  return (
    <div
      className={s.preview}
      role="img"
      aria-label="Preview of the séance workspace: COBOL lines 21 to 22 highlighted, with the ghost's explanation beside them"
    >
      <div className={s.task}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="#E9A957" strokeWidth="1.5"/></svg>
        <span className={s.q}>Parse sales.csv and total the sales <span>· COBOL</span></span>
        <span className={s.pill}><i />Spirit present</span>
      </div>
      <div className={s.body}>
        <div className={`${s.code} crt`}>
          {LINES.map(l => (
            <div key={l.n} className={l.on ? s.on : undefined}><b>{l.n}</b>{l.toks.map(render)}</div>
          ))}
        </div>
        <div className={s.ghost}>
          <div className={s.who}>
            <PlanchetteMark size={16} /> The ghost · lines {PREVIEW_RANGE[0]}–{PREVIEW_RANGE[1]}
          </div>
          {PREVIEW_STEP?.quote && <blockquote data-preview="quote">“{PREVIEW_STEP.quote}”</blockquote>}
          {PREVIEW_STEP && <p data-preview="text">{PREVIEW_STEP.text}</p>}
        </div>
      </div>
      <div className={s.py}>
        <span className={s.tag}>Python</span>
        {PREVIEW_PY && <span data-preview="python">{PREVIEW_PY.text.trim()}</span>}
        <span className={s.match}>✓ Both print 5871.50</span>
      </div>
    </div>
  )
}
