/** FinalCall: the closing band with the last "Begin a séance" CTA. */
import { PillCTA } from './PillCTA.tsx'
import s from './LandingBands.module.css'

export function FinalCall() {
  return (
    <section className={`${s.band} ${s.final}`} aria-labelledby="final-title">
      <h2 id="final-title" className={s.h2}>The candles are lit. <span className={s.accent}>Ask anything.</span></h2>
      <p>Pick a suggestion or describe a task of your own.</p>
      <div className={s.ctas}><PillCTA /></div>
    </section>
  )
}
