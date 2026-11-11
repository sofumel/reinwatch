import type { DayTotals, Totals, TurnSummary } from '../types'

// The 30-day totals kept in $.store: numbers and day strings only, never a description. Pure functions; `now` is passed in.
// days-v2: totals count new tokens. days-v1 counted cache reads and is deliberately left unread, neither migrated nor deleted.
export const HISTORY_KEY = 'days-v2'
const DAY_MS = 86_400_000
const KEEP_DAYS = 30

// The clock reading shifted by the zone's offset (minutes, as Date.getTimezoneOffset gives them: east of UTC is negative),
// so that dayOf names the person's own day, not the UTC one.
export function localTime(now: number, offsetMinutes: number = new Date(now).getTimezoneOffset()): number {
  return now - offsetMinutes * 60_000
}

export function dayOf(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

const count = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

export function parseDays(raw: unknown): DayTotals[] {
  if (!Array.isArray(raw)) return []
  const days: DayTotals[] = []
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const d = item as Record<string, unknown>
    if (typeof d['day'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d['day']) && count(d['agents']) && count(d['tokens']) && count(d['activeMs'])) {
      // Entries of one day add up, so a day is never held twice.
      const same = days.find(x => x.day === d['day'])
      if (same === undefined) days.push({ day: d['day'], agents: d['agents'], tokens: d['tokens'], activeMs: d['activeMs'] })
      else {
        same.agents += d['agents']
        same.tokens += d['tokens']
        same.activeMs += d['activeMs']
      }
    }
  }
  return days
}

export function addTurn(days: readonly DayTotals[], s: TurnSummary, now: number): DayTotals[] {
  const today = dayOf(now)
  const oldest = dayOf(now - (KEEP_DAYS - 1) * DAY_MS)
  // Days dated after today are kept (a westward zone change must lose nothing); `totals` ignores them.
  const next = days.filter(d => d.day >= oldest).map(d => ({ day: d.day, agents: d.agents, tokens: d.tokens, activeMs: d.activeMs }))
  const row = next.find(d => d.day === today)
  if (row === undefined) next.push({ day: today, agents: s.newAgents, tokens: s.tokens, activeMs: s.activeMs })
  else {
    row.agents += s.newAgents
    row.tokens += s.tokens
    row.activeMs += s.activeMs
  }
  return next.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export function totals(days: readonly DayTotals[], now: number): Totals {
  const oldest = dayOf(now - (KEEP_DAYS - 1) * DAY_MS)
  const today = dayOf(now)
  const sum: Totals = { agents: 0, tokens: 0, activeMs: 0 }
  for (const d of days) {
    if (d.day < oldest || d.day > today) continue
    sum.agents += d.agents
    sum.tokens += d.tokens
    sum.activeMs += d.activeMs
  }
  return sum
}
