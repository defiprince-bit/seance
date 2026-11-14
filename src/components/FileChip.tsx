/** FileChip — "sales.csv · 4 rows" in Plex Mono 12px, with a remove ×. */
import s from './FileChip.module.css'

interface FileChipProps {
  name: string
  rows: number
  onRemove?: () => void
  disabled?: boolean
}

export function FileChip({ name, rows, onRemove, disabled }: FileChipProps) {
  return (
    <span className={s.file}>
      <svg viewBox="0 0 16 16" fill="none" width={14} height={14} aria-hidden="true">
        <path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span>{name} · {rows} {rows === 1 ? 'row' : 'rows'}</span>
      {onRemove && (
        <button type="button" className={s.remove} onClick={onRemove} disabled={disabled} aria-label={`Remove ${name}`}>
          <svg viewBox="0 0 12 12" fill="none" width={10} height={10} aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}
