/**
 * tests/summonRegressions.test.ts
 * Live sales séances failed to compile because openai/gpt-oss-120b
 *   1. split statements with a "-" continuation marker (GnuCOBOL glued
 *      "...BY 1" onto "UNTIL" as "1UNTIL"), and
 *   2. wrote DISPLAY WS-TOTAL EDITED "ZZZZZZ9.99", which is not COBOL.
 * Validates: Requirements 3.4, 4.4 and steering cobol-generation.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lintFixedFormat } from '../src/lib/cobolFormat.ts'
import { SUMMON_SYSTEM_PROMPT, buildSummonRepairPrompt } from '../server/llm/prompts/summon.ts'

/** Captured verbatim from a local summon (same model, 9 Nov 2026). Line 24 is a continuation. */
const CAPTURED = [
  '       IDENTIFICATION DIVISION.', '       PROGRAM-ID. TOTAL-SALES.', '       END-IDENTIFICATION DIVISION.',
  '       ENVIRONMENT DIVISION.', '       CONFIGURATION SECTION.', '       END-ENVIRONMENT DIVISION.',
  '       DATA DIVISION.', '       WORKING-STORAGE SECTION.', '       01  WS-COUNT          PIC 9(4).',
  '       01  WS-I              PIC 9(4).', '       01  WS-LINE           PIC X(200).',
  '       01  WS-REGION         PIC X(50).', '       01  WS-AMOUNT-STR     PIC X(20).',
  '       01  WS-AMOUNT         PIC S9(9)V99.', '       01  WS-TOTAL          PIC S9(9)V99 VALUE 0.',
  '       01  WS-TOTAL-DISP    PIC Z(9)9.99.', '       PROCEDURE DIVISION.', '      * Main processing',
  '           ACCEPT WS-COUNT', '           PERFORM VARYING WS-I FROM 1 BY 1', '           UNTIL WS-I > WS-COUNT',
  '           ACCEPT WS-LINE', '           UNSTRING WS-LINE DELIMITED BY "," INTO',
  '     -     WS-REGION WS-AMOUNT-STR',
  '           COMPUTE WS-AMOUNT = FUNCTION NUMVAL(WS-AMOUNT-STR)', '           ADD WS-AMOUNT TO WS-TOTAL',
  '           END-PERFORM', '           MOVE WS-TOTAL TO WS-TOTAL-DISP',
  '           DISPLAY "TOTAL SALES:" WS-TOTAL-DISP', '           STOP RUN.',
]

/** Built around the two lines reported from the Vercel deploy (the full program was not available). */
const REPORTED = [
  '       IDENTIFICATION DIVISION.', '       PROGRAM-ID. TOTAL-SALES.', '       ENVIRONMENT DIVISION.',
  '       DATA DIVISION.', '       WORKING-STORAGE SECTION.', '       01  WS-COUNT         PIC 9(4).',
  '       01  WS-INDEX         PIC 9(4).', '       01  WS-LINE          PIC X(200).',
  '       01  WS-REGION        PIC X(50).', '       01  WS-AMOUNT-STR    PIC X(20).',
  '       01  WS-AMOUNT        PIC S9(7)V99.', '       01  WS-TOTAL         PIC S9(7)V99 VALUE ZERO.',
  '       PROCEDURE DIVISION.', '      * Read every sale and add it up', '           ACCEPT WS-COUNT',
  '           PERFORM VARYING WS-INDEX FROM 1 BY 1',
  '      -    UNTIL WS-INDEX > WS-COUNT',
  '               ACCEPT WS-LINE', '               UNSTRING WS-LINE DELIMITED BY ","',
  '                   INTO WS-REGION WS-AMOUNT-STR', '               END-UNSTRING',
  '               COMPUTE WS-AMOUNT = FUNCTION NUMVAL(WS-AMOUNT-STR)', '               ADD WS-AMOUNT TO WS-TOTAL',
  '           END-PERFORM',
  '           DISPLAY WS-TOTAL EDITED "ZZZZZZ9.99"',
  '           STOP RUN.',
]

/** Each continuation line rewritten the way the prompt asks: no marker, text in Area B. */
const unContinue = (lines: string[]) => lines.map(l => (/^\s{0,6}-/.test(l) ? '               ' + l.replace(/^\s*-\s*/, '') : l))

describe('lintFixedFormat flags continuation lines', () => {
  it('the reported program: "-" in column 7 on the UNTIL line', () => {
    const issues = lintFixedFormat(REPORTED)
    expect(issues).toEqual([expect.objectContaining({ line: 17, kind: 'continuation' })])
    expect(issues[0].detail).toContain('column 7')
  })

  it('the captured program: "-" in column 6 is a continuation, not just a sequence-area problem', () => {
    const issues = lintFixedFormat(CAPTURED)
    expect(issues).toEqual([expect.objectContaining({ line: 24, kind: 'continuation' })])
    expect(issues[0].detail).toContain('column 6')
  })

  it('the repair message tells the model what to do instead', () => {
    const msg = buildSummonRepairPrompt(lintFixedFormat(REPORTED))
    expect(msg).toContain('line 17 uses a "-" continuation marker in column 7')
    expect(msg).toContain('start this line in Area B (column 12 or later)')
  })

  it('both programs lint clean once the continuation lines are rewritten', () => {
    expect(lintFixedFormat(unContinue(REPORTED))).toEqual([])
    expect(lintFixedFormat(unContinue(CAPTURED))).toEqual([])
  })

  it('a "-" later in a line (a minus, a hyphenated name) is not a continuation', () => {
    expect(lintFixedFormat(['           COMPUTE WS-NET = WS-GROSS - WS-TAX'])).toEqual([])
  })
})

describe('summon prompt rules for both mistakes', () => {
  it('forbids continuation lines and shows a plain Area-B continuation', () => {
    expect(SUMMON_SYSTEM_PROMPT).toContain('NEVER use continuation lines')
    expect(SUMMON_SYSTEM_PROMPT).toContain('never "-"')
  })

  it('formats money with MOVE to an edited PIC, and forbids EDITED', () => {
    expect(SUMMON_SYSTEM_PROMPT).toContain('MOVE WS-TOTAL TO WS-TOTAL-OUT')
    expect(SUMMON_SYSTEM_PROMPT).toContain('WS-TOTAL-OUT  PIC Z(6)9.99')
    expect(SUMMON_SYSTEM_PROMPT).toContain('There is no EDITED keyword')
  })

  it('forbids invented division END markers', () => {
    expect(SUMMON_SYSTEM_PROMPT).toContain('never write\n  END-IDENTIFICATION')
  })

  it('every example line in the prompt passes the lint (dots stand for spaces)', () => {
    // bare examples ("    ......MOVE …") and labelled templates ("    comment   ......* …   (note)")
    const examples = SUMMON_SYSTEM_PROMPT.split('\n')
      .map(l => /^ {4}(?:[a-z][a-z0-9 ]*?\s{2,})?(\.{5,})(\S.*?)(?:\s{3,}\(.*\))?$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => ' '.repeat(m[1].length) + m[2])
    expect(examples).toEqual(expect.arrayContaining([
      '      * Read every sale and add it up',
      '               UNTIL WS-I > WS-COUNT',
      '               INTO WS-REGION WS-AMOUNT-TXT',
      '           MOVE WS-TOTAL TO WS-TOTAL-OUT',
      '       01  WS-TOTAL-OUT  PIC Z(6)9.99.',
    ]))
    expect(lintFixedFormat(examples)).toEqual([])
  })

  it('the "Wrong:" examples are exactly what the lint rejects', () => {
    const wrong = SUMMON_SYSTEM_PROMPT.split('\n')
      .map(l => /^\s*Wrong:\s{2}(\.+)(\S.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => ' '.repeat(m[1].length) + m[2])
    expect(wrong).toHaveLength(2)
    expect(lintFixedFormat(wrong).map(i => i.kind)).toEqual(['continuation', 'continuation'])
  })
})

describe('api/summon sends a continuation program back for the one repair retry', () => {
  const asProgram = (lines: string[]) => JSON.stringify({
    program: { language: 'cobol', dialect: 'cobol85-fixed', filename: 'total-sales.cob', title: 'Total sales', lines },
  })
  const llmReply = (content: string) => ({
    ok: true, status: 200,
    json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }),
  })

  async function callSummon(task: string) {
    const { default: handler } = await import('../api/summon.ts')
    let status = 0
    let body: unknown
    const res = {
      status(c: number) { status = c; return res },
      json(d: unknown) { body = d; return res },
    }
    // only the fields the handler reads
    await handler({ method: 'POST', headers: {}, body: { task, language: 'cobol', csvHeader: 'region,amount' } } as never, res as never)
    return { status, body: body as { program?: { lines: string[] } } }
  }

  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.stubEnv('LLM_API_KEY', 'fake-key')
    vi.stubEnv('LLM_MODEL', 'fake-model')
    vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('a continuation line triggers the repair turn, and the fixed program is returned', async () => {
    fetchMock
      .mockResolvedValueOnce(llmReply(asProgram(REPORTED)))
      .mockResolvedValueOnce(llmReply(asProgram(unContinue(REPORTED))))

    const { status, body } = await callSummon('Total the sales in a CSV (repair test 1)')

    expect(status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { messages: { role: string; content: string }[] }
    const repair = second.messages.at(-1)!
    expect(repair.role).toBe('user')
    expect(repair.content).toContain('line 17 uses a "-" continuation marker in column 7')
    expect(body.program?.lines).toEqual(unContinue(REPORTED))
  })

  it('a clean program goes straight through with one LLM call', async () => {
    fetchMock.mockResolvedValueOnce(llmReply(asProgram(unContinue(CAPTURED))))
    const { status } = await callSummon('Total the sales in a CSV (repair test 2)')
    expect(status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
