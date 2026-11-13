/**
 * src/services/golden.ts
 * Loads every golden séance in src/fixtures/golden/*.json at build time (Vite
 * glob) and validates it. A fixture that fails the schema is left out, so its
 * chip falls back to a live summon instead of replaying something broken.
 */
import { GoldenSeanceSchema } from '../lib/golden.ts'
import type { GoldenSeance } from '../lib/golden.ts'

const modules = import.meta.glob('../fixtures/golden/*.json', { eager: true, import: 'default' })

function load(files: Record<string, unknown>): Map<string, GoldenSeance> {
  const out = new Map<string, GoldenSeance>()
  for (const [path, data] of Object.entries(files)) {
    const parsed = GoldenSeanceSchema.safeParse(data)
    if (!parsed.success) {
      console.warn(`[seance] ignoring invalid golden séance ${path}: ${parsed.error.issues[0]?.message}`)
      continue
    }
    out.set(parsed.data.slug, parsed.data)
  }
  return out
}

const GOLDEN = load(modules)

/** The golden séance for a chip, or undefined if none is shipped. */
export function goldenFor(slug: string): GoldenSeance | undefined {
  return GOLDEN.get(slug)
}

/** Slugs that have a fixture (for tests and diagnostics). */
export function goldenSlugs(): string[] {
  return [...GOLDEN.keys()].sort()
}
