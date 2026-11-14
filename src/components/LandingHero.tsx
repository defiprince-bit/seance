/** LandingHero: headline, lede, CTAs, footnote, prop tiles and the hero object. */
import hatUrl from '../../design/assets/prop-hat-floppy.png'
import candleUrl from '../../design/assets/prop-candle-cards.png'
import { FOOTNOTE } from '../lib/copy.ts'
import { useReducedMotion } from '../state/useMedia.ts'
import { PillCTA } from './PillCTA.tsx'
import { FeatureChips } from './FeatureChips.tsx'
import { PropTile } from './PropTile.tsx'
import { HeroObject } from './HeroObject.tsx'
import s from './Landing.module.css'

export function LandingHero() {
  const reduced = useReducedMotion()
  return (
    <section className={s.hero} aria-labelledby="landing-title" data-motion={reduced ? 'reduced' : 'full'}>
      <div className={s.copy}>
        <h1 id="landing-title" className={s.h1}>
          Ask in plain English,<br />get an answer from <span className={s.accent}>1959</span>
        </h1>
        <p className={s.lede}>
          Séance writes your task in COBOL and runs it. A patient ghost explains every line, then brings the
          answer back to modern Python and checks that both runs agree.
        </p>
        <div className={s.ctas}>
          <PillCTA />
          <a className={s.textLink} href="#how">See how it works</a>
        </div>
        <p className={s.foot} data-footnote="">{FOOTNOTE}</p>
        <FeatureChips mobile />
        <div className={s.tiles}>
          <PropTile img={hatUrl} href="#how" ariaLabel="How it works" />
          <PropTile img={candleUrl} href="#peek" ariaLabel="Inside a séance" />
        </div>
      </div>
      <div className={s.stage}>
        <HeroObject />
        <FeatureChips />
      </div>
    </section>
  )
}
