/**
 * LandingPreview: a static picture of the workspace. The COBOL lines, the
 * Python line and the 5871.50 result come from the golden "Sales total"
 * séance (src/fixtures/golden/sales.json), so the picture shows real output.
 */
import { PlanchetteMark } from './PlanchetteMark.tsx'
import s from './LandingPreview.module.css'

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
          <div className={s.who}><PlanchetteMark size={16} /> The ghost · lines 21–22</div>
          <blockquote>“We had no split(). We had UNSTRING, and we liked it.”</blockquote>
          <p>It cuts each line at the comma and pours the pieces into two named boxes: the region, then the amount as text.</p>
        </div>
      </div>
      <div className={s.py}>
        <span className={s.tag}>Python</span>
        <span>parts = line.split(&apos;,&apos;)</span>
        <span className={s.match}>✓ Both print 5871.50</span>
      </div>
    </div>
  )
}
