/**
 * WhyCobol: the #why band. The mock's "the people who wrote them are retiring"
 * line is an unsourced claim (Req 11.4), so this band sticks to what Séance does.
 */
import s from './LandingBands.module.css'

export function WhyCobol() {
  return (
    <section className={s.band} id="why" aria-labelledby="why-title">
      <div className={s.why}>
        <h2 id="why-title" className={s.quote}>
          COBOL was written so people could read it. <span className={s.accent}>Séance reads it with you.</span>
        </h2>
        <div>
          <p>Séance is a gentle first hour with COBOL. You don’t install a compiler or read a manual first.</p>
          <p>Ask about something you already know how to do, and watch how it was done before you were born.</p>
        </div>
      </div>
    </section>
  )
}
