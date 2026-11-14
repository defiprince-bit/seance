/** SeancePeek: the "Inside a séance" band (#peek). */
import { LandingPreview } from './LandingPreview.tsx'
import s from './LandingBands.module.css'

export function SeancePeek() {
  return (
    <section className={s.band} id="peek" aria-labelledby="peek-title">
      <div className={s.peek}>
        <LandingPreview />
        <div>
          <span className={s.eyebrow}>Inside a séance</span>
          <h2 id="peek-title" className={s.h2}>A ghost who <span className={s.accent}>shows its work</span></h2>
          <ul className={s.list}>
            <li>A working program for a task you already understand</li>
            <li>A plain-English reason for every line</li>
            <li>Each idea mapped to the Python you already know</li>
          </ul>
          <p className={s.foot}>Generated code is for learning, not production.</p>
        </div>
      </div>
    </section>
  )
}
