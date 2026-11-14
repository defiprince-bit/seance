/** LandingNav: wordmark, section links, and two round buttons (peek, begin). */
import { WORKSPACE_PATH } from '../lib/copy.ts'
import { PlanchetteMark } from './PlanchetteMark.tsx'
import { PlanchetteIcon } from './PlanchetteIcon.tsx'
import s from './Landing.module.css'

export function LandingNav() {
  return (
    <header className={s.nav}>
      <a className={s.wm} href="/" aria-label="Séance home">
        <PlanchetteMark />
        <b>Séance</b>
      </a>
      <nav className={s.links} aria-label="Primary">
        <a href="#how">How it works</a>
        <a href="#spirits">The spirits</a>
        <a href="#peek">Inside a séance</a>
        <a href="#why">Why COBOL</a>
      </nav>
      <div className={s.navR}>
        <a className={`${s.round} ${s.dark}`} href="#peek" aria-label="See inside a séance">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </a>
        <a className={`${s.round} ${s.pumpkin}`} href={WORKSPACE_PATH} aria-label="Begin a séance" data-cta="begin">
          <PlanchetteIcon />
        </a>
      </div>
    </header>
  )
}
