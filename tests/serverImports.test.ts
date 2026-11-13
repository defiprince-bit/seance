/**
 * tests/serverImports.test.ts
 * Guard for the Vercel deploy. Vercel compiles each api/*.ts file but keeps
 * import specifiers as written, so a relative "./x.ts" import fails at runtime
 * with ERR_MODULE_NOT_FOUND. Everything api/ can reach (api/, server/, src/lib/)
 * must import relative files with ".js".
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['api', 'server', 'src/lib']

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g

describe('API-reachable files use .js relative imports', () => {
  const files = DIRS.flatMap(d => tsFiles(join(ROOT, d)))

  it('finds the files it is meant to guard', () => {
    const names = files.map(f => relative(ROOT, f).replace(/\\/g, '/'))
    expect(names).toEqual(expect.arrayContaining(['api/summon.ts', 'api/run.ts', 'api/narrate.ts', 'src/lib/schemas.ts']))
  })

  it.each(DIRS)('no relative import in %s/ ends in .ts', dir => {
    const offenders: string[] = []
    for (const file of files.filter(f => relative(ROOT, f).replace(/\\/g, '/').startsWith(dir + '/'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(RELATIVE_IMPORT)) {
        if (m[1].endsWith('.ts')) offenders.push(`${relative(ROOT, file)}: ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
