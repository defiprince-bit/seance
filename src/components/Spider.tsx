/** Spider: 18px line-art spider on a thread under the top-right web. Decorative. */
import { useReducedMotion } from '../state/useMedia.ts'
import s from './Landing.module.css'

export function Spider() {
  const reduced = useReducedMotion()
  return (
    <div className={s.spider} aria-hidden="true" data-anim={reduced ? undefined : 'dangle'}>
      <div className={s.thread} />
      <svg viewBox="0 0 24 24" fill="none">
        <g stroke="#F4EADF" strokeWidth="1.3" strokeLinecap="round">
          <path d="M9 10 4 6M9 12H3M9 14l-5 3M10 15l-3 5M15 10l5-4M15 12h6M15 14l5 3M14 15l3 5"/>
        </g>
        <ellipse cx="12" cy="13" rx="3.4" ry="4" fill="#1A1A1D" stroke="#F4EADF" strokeWidth="1.2"/>
        <circle cx="12" cy="8.6" r="2" fill="#1A1A1D" stroke="#F4EADF" strokeWidth="1.2"/>
      </svg>
    </div>
  )
}
