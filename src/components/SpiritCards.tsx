/**
 * SpiritCards: the spirits band (#spirits), driven by src/lib/spirits.ts.
 * Only enabled spirits link to the workspace; resting ones say so plainly.
 */
import { SPIRITS } from '../lib/spirits.ts'
import type { Spirit } from '../lib/spirits.ts'
import { WORKSPACE_PATH } from '../lib/copy.ts'
import s from './LandingBands.module.css'

const SNIPPETS: Record<string, string> = {
  cobol: 'ADD WS-AMOUNT TO WS-TOTAL\nDISPLAY "TOTAL SALES: " WS-TOTAL-OUT',
  fortran: "total = total + amount\nprint '(A,F10.2)', 'TOTAL:', total",
  basic: '40 LET T = T + A\n50 GOTO 20',
}

function SpiritBody({ spirit }: { spirit: Spirit }) {
  return (
    <>
      <div className={s.top}>
        <h3 className={s.spiritName}>{spirit.name}</h3>
        <span className={s.yr}>b. {spirit.born}</span>
      </div>
      <div className={s.ep}>{spirit.epithet}</div>
      {!spirit.enabled && <span className={s.tag}>Resting · not answering yet</span>}
      <pre className={`${s.snippet} crt`} aria-hidden="true">{SNIPPETS[spirit.id]}</pre>
      <p>{spirit.blurb}</p>
    </>
  )
}

export function SpiritCards() {
  return (
    <section className={s.band} id="spirits" aria-labelledby="spirits-title">
      <div className={s.sh}>
        <div>
          <span className={s.eyebrow}>The spirits</span>
          <h2 id="spirits-title" className={s.h2}>Choose <span className={s.accent}>who answers</span></h2>
        </div>
        <p>Each language has its own temperament. COBOL answers today. Fortran and BASIC are resting.</p>
      </div>
      <ul className={s.grid3}>
        {SPIRITS.map(sp => (
          <li key={sp.id}>
            {sp.enabled ? (
              <a className={`${s.card} ${s.spirit}`} href={WORKSPACE_PATH} data-spirit={sp.id}>
                <SpiritBody spirit={sp} />
              </a>
            ) : (
              <div className={`${s.card} ${s.spirit} ${s.resting}`} data-spirit={sp.id}>
                <SpiritBody spirit={sp} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
