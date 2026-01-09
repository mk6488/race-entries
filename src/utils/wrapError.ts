export function wrapError(scope: string, err: unknown, meta?: Record<string, unknown>): Error {
  const metaSafe = meta
    ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, safeValue(v)]))
    : undefined
  const base = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
  const metaStr = metaSafe ? ` | meta=${JSON.stringify(metaSafe)}` : ''
  const e = new Error(`[${scope}] ${base}${metaStr}`)
  if (err instanceof Error && err.stack) {
    e.stack = err.stack
  }
  return e
}

function safeValue(v: unknown): string | number | boolean {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v
  return typeof v === 'object' && v !== null ? '[object]' : String(v)
}
