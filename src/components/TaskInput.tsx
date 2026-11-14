/**
 * TaskInput — 52px task entry, CSV attach + FileChip, and SummonButton.
 * Ctrl/Cmd+Enter submits; `/` anywhere outside a text field focuses it.
 * A picked .csv is checked against the 64 KB / 500-row limits (Req 1.4, 1.5);
 * a rejected file leaves the task text alone and shows why, inline.
 */
import { useRef, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Phase, CsvData } from '../state/seance.ts'
import { checkCsvMeta, checkCsvFile } from '../lib/csvFile.ts'
import { SummonButton } from './SummonButton.tsx'
import type { SummonState } from './SummonButton.tsx'
import { FileChip } from './FileChip.tsx'
import s from './TaskInput.module.css'

/** "Edit the task" focuses and selects this input. */
export const TASK_INPUT_ID = 'task-input'
const FILE_ERROR_ID = 'task-file-error'

/** File contents as UTF-8 text, via FileReader (every browser and jsdom have it). */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

interface TaskInputProps {
  value: string
  phase: Phase
  hasRun: boolean
  /** the attached CSV for the next typed summon, if any */
  file?: CsvData
  onChange: (v: string) => void
  onFileChange: (file: CsvData | undefined) => void
  onSubmit: () => void
}

export function TaskInput({ value, phase, hasRun, file, onChange, onFileChange, onSubmit }: TaskInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string>()
  const busy = phase === 'summoning' || phase === 'running'
  const empty = value.trim() === '' // Req 1.6
  const remaining = 500 - value.length

  useEffect(() => { inputRef.current?.focus() }, []) // Req 1.1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!empty && !busy) onSubmit()
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = '' // so the same file can be picked again
    if (!picked) return
    // check the size before reading, so a huge file is never loaded
    const early = checkCsvMeta(picked.name, picked.size)
    let text: string
    try { text = early ? '' : await readText(picked) }
    catch { setFileError(`Couldn't read ${picked.name}. Try another file.`); return }
    const result = early ?? checkCsvFile(picked.name, picked.size, text)
    if (!result.ok) { setFileError(result.message); return }
    setFileError(undefined)
    onFileChange(result.csv)
  }

  const remove = () => {
    setFileError(undefined)
    onFileChange(undefined)
    inputRef.current?.focus()
  }

  const btnState: SummonState = busy ? 'summoning' : hasRun ? 'again' : 'idle'

  return (
    <div className={s.wrap}>
      <div className={s.taskbar}>
        <label className={s.task}>
          <svg className={s.arrow} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="#E9A957" strokeWidth="1.5"/>
          </svg>
          <input
            ref={inputRef}
            id={TASK_INPUT_ID}
            className={s.input}
            value={value}
            maxLength={500}
            placeholder="Describe a task in plain English…"
            disabled={busy}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Your task"
            aria-describedby={fileError ? FILE_ERROR_ID : undefined}
          />
          {value.length > 400 && <span className={s.count} aria-live="polite">{remaining} left</span>}
          {file
            ? <FileChip name={file.name} rows={file.rows} onRemove={remove} disabled={busy} />
            : (
              <button type="button" className={s.attach} onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Attach a CSV file">
                <svg viewBox="0 0 16 16" fill="none" width={16} height={16} aria-hidden="true">
                  <path d="M10.5 5 6 9.5a1.4 1.4 0 0 0 2 2L13 6.5a2.8 2.8 0 0 0-4-4L4 7.5a4.2 4.2 0 0 0 6 6l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span className={s.attachLabel}>CSV</span>
              </button>
            )}
        </label>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onPick} data-testid="csv-input" />
        <SummonButton state={btnState} disabled={empty || busy} onClick={onSubmit} />
      </div>
      {fileError && <p id={FILE_ERROR_ID} className={s.fileError} role="alert">{fileError}</p>}
    </div>
  )
}
