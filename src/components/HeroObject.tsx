/**
 * HeroObject: the jack-o'-lantern terminal over a breathing pumpkin glow.
 * Float/tilt and breathing run only when the user allows motion.
 */
import heroUrl from '../../design/assets/hero-terminal-dark.jpg'
import { useReducedMotion } from '../state/useMedia.ts'
import s from './Landing.module.css'

export const HERO_ALT =
  'A friendly old computer terminal whose green screen glows with a carved pumpkin face, sitting on a stack of punch cards'

export function HeroObject() {
  const reduced = useReducedMotion()
  return (
    <>
      <div className={s.glow} aria-hidden="true" data-anim={reduced ? undefined : 'breathe'} />
      <img
        className={s.obj}
        src={heroUrl}
        alt={HERO_ALT}
        width={728}
        height={750}
        data-hero=""
        data-anim={reduced ? undefined : 'float'}
      />
    </>
  )
}
