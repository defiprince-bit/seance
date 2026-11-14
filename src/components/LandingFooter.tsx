/** LandingFooter: wordmark and the Req 11.3 footnote, word for word. */
import { FOOTNOTE } from '../lib/copy.ts'
import { PlanchetteMark } from './PlanchetteMark.tsx'
import nav from './Landing.module.css'
import s from './LandingBands.module.css'

export function LandingFooter() {
  return (
    <footer className={s.footRow}>
      <a className={`${nav.wm} ${s.footWm}`} href="/" aria-label="Séance home">
        <PlanchetteMark />
        <b>Séance</b>
      </a>
      <p>A learning project, 2026. <span data-footnote="">{FOOTNOTE}</span></p>
    </footer>
  )
}
