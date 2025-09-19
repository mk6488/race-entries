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
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
}


