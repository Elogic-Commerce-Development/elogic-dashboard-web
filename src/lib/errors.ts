/**
 * PostgREST errors are plain objects (`{message, details, hint, code}`), not
 * `Error` instances — so the usual `e instanceof Error ? e.message : String(e)`
 * renders them as the useless literal "[object Object]". That is exactly what
 * the first deployed load of Radar showed, which told us nothing about which
 * of six queries had failed.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [o.message, o.details, o.hint].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )
    const code = typeof o.code === 'string' && o.code.length > 0 ? ` [${o.code}]` : ''
    if (parts.length > 0) return `${parts.join(' — ')}${code}`
  }
  return String(e)
}
