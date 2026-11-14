/**
 * tests/fileAttach.test.tsx  (task 12)
 * CSV attach: limits (Req 1.4, 1.5), the FileChip, the header reaching
 * /api/summon as csvHeader and the body reaching /api/run through
 * encodeStdin, remove clearing it, and chips still replaying golden séances.
 * fetch is mocked; nothing leaves the test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { checkCsvFile, checkCsvMeta, MAX_CSV_BYTES, MAX_CSV_ROWS } from '../src/lib/csvFile.ts'
import { encodeStdin } from '../src/lib/stdin.ts'
import { Workspace } from '../src/components/Workspace.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SALES = 'region,amount\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n'
const csvOfRows = (n: number) => 'name,amount\n' + Array.from({ length: n }, (_, i) => `r${i},1.00`).join('\n') + '\n'

describe('checkCsvFile (Req 1.4, 1.5)', () => {
  it('counts data rows the way the stdin protocol does', () => {
    expect(checkCsvFile('sales.csv', SALES.length, SALES)).toEqual({ ok: true, csv: { name: 'sales.csv', rows: 4, text: SALES } })
    expect(checkCsvFile('crlf.csv', 30, 'h\r\na,1\r\nb,2\r\n\r\n')).toMatchObject({ ok: true, csv: { rows: 2 } })
  })

  it(`accepts exactly ${MAX_CSV_ROWS} rows and rejects ${MAX_CSV_ROWS + 1}`, () => {
    expect(checkCsvFile('ok.csv', 100, csvOfRows(MAX_CSV_ROWS))).toMatchObject({ ok: true, csv: { rows: 500 } })
    expect(checkCsvFile('big.csv', 100, csvOfRows(MAX_CSV_ROWS + 1))).toEqual({ ok: false, message: 'big.csv has 501 data rows. Files can have at most 500.' })
  })

  it('accepts exactly 64 KB and rejects one byte more, before reading', () => {
    expect(checkCsvMeta('ok.csv', MAX_CSV_BYTES)).toBeUndefined()
    expect(checkCsvMeta('big.csv', MAX_CSV_BYTES + 1)).toEqual({ ok: false, message: 'big.csv is 65 KB. Files can be at most 64 KB.' })
  })

  it('rejects files that are not .csv, and a header with no data', () => {
    expect(checkCsvMeta('notes.txt', 10)).toMatchObject({ ok: false })
    expect(checkCsvFile('empty.csv', 14, 'region,amount\n')).toEqual({ ok: false, message: 'empty.csv has a header but no data rows.' })
  })
})

// ---------------------------------------------------------------------------
// Workspace with mocked APIs
// ---------------------------------------------------------------------------

const PROGRAM = { program: { language: 'cobol', dialect: 'cobol85-fixed', filename: 't.cob', title: 'T', lines: ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. T.', '       PROCEDURE DIVISION.', '           STOP RUN.'] } }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let host: HTMLDivElement
let root: Root
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/summon') return json(200, PROGRAM)
    if (url === '/api/run') return json(200, { stdout: 'TOTAL SALES: 1.00\n', exitCode: 0, runner: 'onlinecompiler' })
    // stop the pipeline before Pyodide: narration "mumbles"
    return json(502, { code: 'ghost-mumbled', error: 'The ghost mumbled.' })
  })
  vi.stubGlobal('fetch', fetchMock)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Workspace />))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const taskInput = () => document.getElementById('task-input') as HTMLInputElement
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')]
const fileChipText = () => document.querySelector('button[aria-label^="Remove "]')?.parentElement?.textContent ?? null
const bodyOf = (path: string) => {
  const call = fetchMock.mock.calls.find(c => c[0] === path)
  return call ? JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown> : undefined
}

async function until(check: () => boolean, ms = 2000) {
  const t0 = Date.now()
  while (!check()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting')
    await act(async () => { await new Promise(r => setTimeout(r, 5)) })
  }
}

function type(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setValue.call(taskInput(), text); taskInput().dispatchEvent(new Event('input', { bubbles: true })) })
}

async function attach(name: string, text: string) {
  const file = new File([text], name, { type: 'text/csv' })
  Object.defineProperty(fileInput(), 'files', { value: [file], configurable: true })
  await act(async () => { fileInput().dispatchEvent(new Event('change', { bubbles: true })) })
  // FileReader is async: wait for the chip or the inline error
  await until(() => fileChipText() !== null || document.querySelector('[role="alert"]') !== null)
}

async function summonTyped() {
  act(() => { buttons().find(b => /^Summon/.test(b.getAttribute('aria-label') ?? ''))!.click() })
  await until(() => fetchMock.mock.calls.length >= 3)
}

describe('attach in the task bar', () => {
  it('a valid file shows the FileChip with its name and data-row count', async () => {
    await attach('sales.csv', SALES)
    expect(fileChipText()).toBe('sales.csv · 4 rows')
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('a file over 64 KB is rejected inline; the task text stays and nothing is attached', async () => {
    type('Total the sales')
    await attach('huge.csv', 'h\n' + 'x,1\n'.repeat(17_000))
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/huge\.csv is \d+ KB\. Files can be at most 64 KB\./)
    expect(fileChipText()).toBeNull()
    expect(taskInput().value).toBe('Total the sales')
  })

  it('a file over 500 data rows is rejected inline', async () => {
    await attach('long.csv', csvOfRows(501))
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('long.csv has 501 data rows. Files can have at most 500.')
    expect(fileChipText()).toBeNull()
  })

  it('a later valid file clears the error message', async () => {
    await attach('long.csv', csvOfRows(501))
    await attach('sales.csv', SALES)
    await until(() => fileChipText() !== null) // the old error is still up until the read finishes
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(fileChipText()).toBe('sales.csv · 4 rows')
  })
})

describe('summon with an attached CSV', () => {
  it('sends the header row to /api/summon and the body to /api/run via encodeStdin', async () => {
    await attach('sales.csv', SALES)
    type('Total the sales')
    await summonTyped()
    expect(bodyOf('/api/summon')).toEqual({ task: 'Total the sales', language: 'cobol', csvHeader: 'region,amount' })
    expect(bodyOf('/api/run')).toMatchObject({ language: 'cobol', stdin: encodeStdin(SALES) })
    expect(bodyOf('/api/run')!.stdin).toBe('4\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n')
  })

  it('remove clears the CSV: the next summon sends no header and the empty stdin', async () => {
    await attach('sales.csv', SALES)
    act(() => { document.querySelector<HTMLButtonElement>('button[aria-label="Remove sales.csv"]')!.click() })
    expect(fileChipText()).toBeNull()
    type('Total the sales')
    await summonTyped()
    expect(bodyOf('/api/summon')).toEqual({ task: 'Total the sales', language: 'cobol' })
    expect(bodyOf('/api/run')!.stdin).toBe('0\n')
  })

  it('a typed task with no file works exactly as before', async () => {
    type('Compound interest on 1000.00')
    await summonTyped()
    expect(bodyOf('/api/summon')).toEqual({ task: 'Compound interest on 1000.00', language: 'cobol' })
    expect(bodyOf('/api/run')!.stdin).toBe(encodeStdin(undefined))
  })
})

describe('chips are not affected by an attachment', () => {
  it('a chip still replays its golden séance (no API call) and the attachment stays for typed tasks', async () => {
    await attach('mine.csv', 'a,b\n1,2\n')
    act(() => { buttons().find(b => b.textContent === 'Total the sales in a CSV')!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(fileChipText()).toBe('mine.csv · 1 row')
  })
})
