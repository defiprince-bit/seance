/**
 * src/lib/csvFile.ts
 * Checks an attached CSV against the limits in Req 1.4 / 1.5. Pure.
 * Data rows are counted with the stdin protocol itself (encodeStdin then
 * decodeStdin), so the chip shows exactly the N the programs will read.
 */
import { encodeStdin, decodeStdin } from './stdin.js'

export const MAX_CSV_BYTES = 64 * 1024
export const MAX_CSV_ROWS = 500

export interface CheckedCsv { name: string; rows: number; text: string }
export type CsvCheck = { ok: true; csv: CheckedCsv } | { ok: false; message: string }

const kb = (bytes: number) => `${Math.ceil(bytes / 1024)} KB`

/** Size and type, before reading the file. */
export function checkCsvMeta(name: string, bytes: number): CsvCheck | undefined {
  if (!/\.csv$/i.test(name)) return { ok: false, message: `${name} isn't a CSV file. Attach a .csv file.` }
  if (bytes > MAX_CSV_BYTES) return { ok: false, message: `${name} is ${kb(bytes)}. Files can be at most 64 KB.` }
  return undefined
}

/** The full check, once the text is read. */
export function checkCsvFile(name: string, bytes: number, text: string): CsvCheck {
  const meta = checkCsvMeta(name, bytes)
  if (meta) return meta
  const rows = decodeStdin(encodeStdin(text)).length
  if (rows === 0) return { ok: false, message: `${name} has a header but no data rows.` }
  if (rows > MAX_CSV_ROWS) return { ok: false, message: `${name} has ${rows} data rows. Files can have at most ${MAX_CSV_ROWS}.` }
  return { ok: true, csv: { name, rows, text } }
}
