/** PillCTA: charcoal pill with a pumpkin planchette dot. Every landing CTA goes to the workspace. */
import { WORKSPACE_PATH } from '../lib/copy.ts'
import { PlanchetteIcon } from './PlanchetteIcon.tsx'
import s from './Landing.module.css'

export function PillCTA({ label = 'Begin a séance', href = WORKSPACE_PATH }: { label?: string; href?: string }) {
  return (
    <a className={s.pillCta} href={href} data-cta="begin">
      <span className={s.dot}><PlanchetteIcon /></span>
      {label}
    </a>
  )
}
