const isProd = import.meta.env.PROD

export function logWarn(scope: string, details: unknown) {
  if (isProd) return
  // Keep dev noise low but available
  console.warn(`[${scope}]`, details)
}

export function logError(scope: string, err: unknown) {
  // Always surface critical errors
  console.error(`[${scope}]`, err)
}
