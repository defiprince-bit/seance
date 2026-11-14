/**
 * Cobweb: original line-art web (design/assets/cobweb.svg) mirrored per corner.
 * Decorative, never over text. Sways only when motion is allowed.
 */
import webUrl from '../../design/assets/cobweb.svg'
import { useReducedMotion } from '../state/useMedia.ts'
import s from './Landing.module.css'

export function Cobweb({ corner }: { corner: 'tr' | 'bl' | 'br' }) {
  const reduced = useReducedMotion()
  return (
    <div className={`${s.web} ${s[corner]}`} aria-hidden="true" data-anim={reduced ? undefined : 'sway'}>
      <img src={webUrl} alt="" />
    </div>
  )
}
