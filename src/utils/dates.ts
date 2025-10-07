export function toInputDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromInputDateTimeLocal(s: string) { return new Date(s) }

export function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromInputDate(s: string) {
  if (!s) return new Date()
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function enumerateDaysInclusive(start: Date, end?: Date | null): Date[] {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : s
  const days: Date[] = []
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return days
}

export function formatDayLabel(d: Date): string {
  const days = ['Sun','Mon','Tue','Wed','Thur','Fri','Sat']
  return days[d.getDay()]
}

export function parseRaceTimeToMs(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/^([0-9]{1,2}):([0-5][0-9])(\.[0-9]{1,3})?$/)
  if (!m) return null
  const minutes = parseInt(m[1], 10)
  const seconds = parseInt(m[2], 10)
  const millis = m[3] ? Math.round(parseFloat(m[3]) * 1000) : 0
  return minutes * 60000 + seconds * 1000 + millis
}

export function formatRaceTime(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return ''
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000
  const secStr = seconds.toString().padStart(2, '0')
  if (millis === 0) return `${minutes}:${secStr}`
  const msStr = Math.round(millis).toString().padStart(3, '0').replace(/0+$/, '')
  return `${minutes}:${secStr}.${msStr}`
}


export function formatUiDate(d: Date): string {
  // Compact, user-friendly date for race cards, e.g. "Sat 7 Oct 2025"
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    // Fallback to ISO if formatter fails
    return toInputDate(d)
  }
}


