/**
 * tests/pythonImports.test.ts
 * missingImports / importFixes. The first case is the exact translation from a
 * live run that died with "NameError: name 'getcontext' is not defined".
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { missingImports, importFixes } from '../src/lib/pythonImports.ts'

const LIVE = `import sys, decimal
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
getcontext().prec=50
n=int(sys.stdin.readline())
ws_total=Decimal('0')
for _ in range(n):
    line=sys.stdin.readline().rstrip('\\n')
    region, amount_txt=line.split(',',1)
    ws_amount=Decimal(amount_txt.strip())
    ws_total+=ws_amount
ws_total=ws_total.quantize(Decimal('0.01'), rounding=ROUND_DOWN)
print(f"TOTAL SALES: {ws_total:0>9.2f}")`

describe('missingImports', () => {
  it('regression: catches getcontext used but not imported', () => {
    expect(missingImports(LIVE)).toEqual([{ name: 'getcontext', module: 'decimal' }])
    expect(importFixes(missingImports(LIVE))).toEqual(['from decimal import getcontext'])
  })

  it('the fixed translation is clean', () => {
    const fixed = LIVE.replace('from decimal import Decimal,', 'from decimal import Decimal, getcontext,')
    expect(missingImports(fixed)).toEqual([])
  })

  it('a module import covers module.attr uses', () => {
    expect(missingImports('import decimal\ndecimal.getcontext().prec = 50\nx = decimal.Decimal("1")')).toEqual([])
  })

  it('flags module.attr without the import', () => {
    expect(missingImports('n = int(sys.stdin.readline())')).toEqual([{ name: 'sys', module: 'sys' }])
    expect(importFixes(missingImports('x = decimal.Decimal("1")\ny = Decimal("2")'))).toEqual(['import decimal', 'from decimal import Decimal'])
  })

  it('star imports and aliases count', () => {
    expect(missingImports('from decimal import *\ngetcontext().prec = 50\nx = Decimal("1")')).toEqual([])
    expect(missingImports('from decimal import Decimal as D, getcontext\nx = D("1")')).toEqual([])
    expect(missingImports('from decimal import (\n    Decimal,\n    ROUND_DOWN,\n)\nx = Decimal("1").quantize(Decimal("0.01"), rounding=ROUND_DOWN)')).toEqual([])
  })

  it('ignores names inside strings and comments', () => {
    expect(missingImports('print("Decimal getcontext sys.stdin")\n# getcontext().prec = 50')).toEqual([])
  })

  it('ignores attributes and names the code defines', () => {
    expect(missingImports('ctx.getcontext()\nx = obj.Decimal')).toEqual([])
    expect(missingImports('def getcontext():\n    return 1\ngetcontext()')).toEqual([])
  })

  it('reports every missing decimal name, grouped into one fix line', () => {
    const code = 'x = Decimal("1").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)\ngetcontext().prec = 50'
    expect(importFixes(missingImports(code))).toEqual(['from decimal import Decimal, getcontext, ROUND_HALF_UP'])
  })

  it('property: prepending the suggested fixes always leaves nothing missing', () => {
    const statements = [
      'getcontext().prec = 50', 'x = Decimal("1.05")', 'n = int(sys.stdin.readline())',
      'y = x.quantize(Decimal("0.01"), rounding=ROUND_DOWN)', 'z = x.quantize(Decimal("1"), rounding=ROUND_HALF_UP)',
      'r = math.floor(2.5)', 'w = decimal.Decimal("2")', 'print("TOTAL: 1.00")',
    ]
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...statements), { minLength: 1, maxLength: 8 }), body => {
        const code = body.join('\n')
        const fixed = [...importFixes(missingImports(code)), code].join('\n')
        expect(missingImports(fixed)).toEqual([])
      }),
      { numRuns: 300 },
    )
  })
})
