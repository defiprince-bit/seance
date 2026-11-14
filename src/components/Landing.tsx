/**
 * Landing (`/`, Req 11): charcoal card on a burnt-orange backdrop with corner
 * cobwebs, the hero, and the bands below. Every "Begin a séance" goes to /seance.
 */
import { useReducedMotion } from '../state/useMedia.ts'
import { Cobweb } from './Cobweb.tsx'
import { Spider } from './Spider.tsx'
import { LandingNav } from './LandingNav.tsx'
import { LandingHero } from './LandingHero.tsx'
import { HowItWorks } from './HowItWorks.tsx'
import { SeancePeek } from './SeancePeek.tsx'
import { SpiritCards } from './SpiritCards.tsx'
import { WhyCobol } from './WhyCobol.tsx'
import { FinalCall } from './FinalCall.tsx'
import { LandingFooter } from './LandingFooter.tsx'
import s from './Landing.module.css'

export function Landing() {
  const reduced = useReducedMotion()
  return (
    <div className={s.landing} data-page="landing" data-motion={reduced ? 'reduced' : 'full'}>
      <div className={s.page}>
        <div className={s.card}>
          <Cobweb corner="tr" />
          <Spider />
          <Cobweb corner="bl" />
          <LandingNav />
          <main>
            <LandingHero />
            <HowItWorks />
            <SeancePeek />
            <SpiritCards />
            <WhyCobol />
            <FinalCall />
          </main>
          <LandingFooter />
          <Cobweb corner="br" />
        </div>
      </div>
    </div>
  )
}
