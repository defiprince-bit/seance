/** PropTile: brown tile with a floating prop image that overflows the top edge. */
import { useReducedMotion } from '../state/useMedia.ts'
import s from './Landing.module.css'

export function PropTile({ img, href, ariaLabel }: { img: string; href: string; ariaLabel: string }) {
  const reduced = useReducedMotion()
  return (
    <a className={s.tile} href={href} aria-label={ariaLabel}>
      <img src={img} alt="" data-anim={reduced ? undefined : 'float'} />
    </a>
  )
}
