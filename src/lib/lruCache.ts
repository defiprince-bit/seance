/**
 * src/lib/lruCache.ts
 * A small bounded LRU cache on top of Map insertion order (Req 12.4). Used by
 * the summon and narrate functions to keep successful responses for the life
 * of the instance without growing without limit. Pure: no I/O.
 */

export class LruCache<V> {
  private readonly map = new Map<string, V>()
  readonly max: number

  constructor(max: number) {
    if (!Number.isInteger(max) || max < 1) throw new Error('LruCache max must be a positive integer')
    this.max = max
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    this.map.delete(key) // refresh: most recently used goes to the end
    this.map.set(key, value)
    return value
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  set(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value as string)
    }
  }

  get size(): number {
    return this.map.size
  }
}
