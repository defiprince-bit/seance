/** HowItWorks: the three-step band (#how). Copy only describes what ships today. */
import s from './LandingBands.module.css'

const STEPS = [
  { title: 'Say what you need', text: 'Type a modern task in plain English, and attach a small CSV if it needs one.' },
  { title: 'The ghost writes and runs it', text: 'Real COBOL appears line by line and runs on a real GnuCOBOL compiler. You see the actual output.' },
  { title: 'Bring it back to Python', text: 'Every line is explained, then translated to modern Python, and both results are checked against each other.' },
]

export function HowItWorks() {
  return (
    <section className={s.band} id="how" aria-labelledby="how-title">
      <div className={s.sh}>
        <div>
          <span className={s.eyebrow}>How a séance works</span>
          <h2 id="how-title" className={s.h2}>Three steps, <span className={s.accent}>one old friend</span></h2>
        </div>
        <p>You never have to write the dead language yourself. You just have to be curious about it.</p>
      </div>
      <ol className={s.grid3}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={s.card}>
            <div className={s.n} aria-hidden="true">{i + 1}</div>
            <h3 className={s.cardTitle}>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
