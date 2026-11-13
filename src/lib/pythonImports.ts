/**
 * src/lib/pythonImports.ts
 * Finds names a Python translation uses without importing them, for the names
 * our translations actually rely on (the decimal module and a few stdlib
 * modules). Pure; api/narrate.ts sends the result back for its one repair retry.
 *
 * Regression: a live translation called getcontext() after
 * "from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP" and died with NameError.
 */

/** Names that must come from `from decimal import …` when used bare. */
const DECIMAL_NAMES = [
  'Decimal', 'getcontext', 'setcontext', 'localcontext', 'Context',
  'ROUND_DOWN', 'ROUND_HALF_UP', 'ROUND_HALF_EVEN', 'ROUND_HALF_DOWN',
  'ROUND_UP', 'ROUND_FLOOR', 'ROUND_CEILING', 'ROUND_05UP',
  'InvalidOperation', 'DivisionByZero',
]
/** Modules that must be imported when used as `module.attr`. */
const MODULES = ['sys', 'decimal', 'math', 'csv', 'io']

export interface MissingImport {
  name: string
  module: string
}

/** Removes comments and string literals (contents only) so they cannot count as uses. */
function codeOnly(src: string): string {
  return src
    .replace(/[rbuf]{0,2}("""|''')[\s\S]*?\1/gi, '""')
    .replace(/[rbuf]{0,2}("|')(?:\\.|(?!\1)[^\\\n])*\1/gi, '""')
    .replace(/#[^\n]*/g, '')
}

/** Names bound by import statements; `*` means everything from that module. */
function importedNames(code: string): { bound: Set<string>; star: Set<string> } {
  const bound = new Set<string>()
  const star = new Set<string>()
  // from m import a, b as c   |   from m import (a,\n b)
  for (const m of code.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(\([^)]*\)|[^\n]+)/gm)) {
    const list = m[2].replace(/[()]/g, ' ')
    if (/^\s*\*\s*$/.test(list)) { star.add(m[1]); continue }
    for (const part of list.split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      if (orig) bound.add((alias ?? orig).trim())
    }
  }
  // import a, b.c as d
  for (const m of code.matchAll(/^\s*import\s+([^\n]+)/gm)) {
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      if (orig) bound.add((alias ?? orig.split('.')[0]).trim())
    }
  }
  return { bound, star }
}

/** Names the code defines itself (assignment, def, class, for, with … as, except … as). */
function definedNames(code: string): Set<string> {
  const out = new Set<string>()
  for (const m of code.matchAll(/^\s*(?:def|class)\s+([A-Za-z_]\w*)/gm)) out.add(m[1])
  for (const m of code.matchAll(/^\s*([A-Za-z_]\w*)\s*(?::[^=\n]*)?=(?!=)/gm)) out.add(m[1])
  for (const m of code.matchAll(/\bfor\s+([A-Za-z_]\w*)\s+in\b/g)) out.add(m[1])
  for (const m of code.matchAll(/\bas\s+([A-Za-z_]\w*)\s*:/g)) out.add(m[1])
  return out
}

/** The code with import statements removed: a name in "import X as Y" is not a use of X. */
function withoutImports(code: string): string {
  return code
    .replace(/^\s*from\s+[\w.]+\s+import\s+\([^)]*\)/gm, '')
    .replace(/^\s*(?:from\s+[\w.]+\s+)?import\s+[^\n]*/gm, '')
}

export function missingImports(source: string): MissingImport[] {
  const all = codeOnly(source)
  const { bound, star } = importedNames(all)
  const code = withoutImports(all)
  const defined = definedNames(code)
  const known = (name: string) => bound.has(name) || defined.has(name)
  const missing: MissingImport[] = []

  for (const name of DECIMAL_NAMES) {
    if (star.has('decimal') || known(name)) continue
    // a bare use: not an attribute (x.getcontext) and not a keyword argument name
    if (new RegExp(`(?<![\\w.])${name}\\b(?!\\s*=(?!=))`).test(code)) missing.push({ name, module: 'decimal' })
  }
  for (const mod of MODULES) {
    if (known(mod)) continue
    if (new RegExp(`(?<![\\w.])${mod}\\.\\w`).test(code)) missing.push({ name: mod, module: mod })
  }
  return missing
}

/** The import lines that would fix it, e.g. "from decimal import Decimal, getcontext". */
export function importFixes(missing: readonly MissingImport[]): string[] {
  const fromDecimal = missing.filter(m => m.module === 'decimal' && m.name !== 'decimal').map(m => m.name)
  const plain = missing.filter(m => m.name === m.module).map(m => `import ${m.name}`)
  return [...plain, ...(fromDecimal.length ? [`from decimal import ${fromDecimal.join(', ')}`] : [])]
}
