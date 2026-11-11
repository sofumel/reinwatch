import type { AgentRow, TurnSummary } from '../types'
import { clean } from './clean.ts'
import { activeMs, newTokens } from './tracker.ts'

// The words reinwatch shows for agents, numbers and turns. Each function depends only on its arguments, and the time
// comes in as `now`, so a test can check every string exactly.

const LABEL_MAX = 60

// What a person calls an agent: its description, else its type, else the start of its id, each on one plain line. A text
// with nothing readable left once cleaned counts as missing.
// Longer than 60 characters is cut to 59 and an ellipsis. Characters are code points, so an emoji is never cut in half.
export function label(row: Pick<AgentRow, 'id' | 'description' | 'type'>): string {
  const text = clean(row.description) || clean(row.type) || clean(`agent ${row.id.slice(0, 8)}`)
  const chars = Array.from(text)
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX - 1).join('')}…` : text
}

// The first `max` code points of a text (an emoji is never cut in half); a shorter text comes back as it is. No ellipsis:
// `label` adds its own when it shortens.
export function cut(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') : text
}

// 999 stays 999, 12345 is 12.3k, 1800000 is 1.8M: rounded to a tenth, and a number prints without a ".0" (1k, not 1.0k).
// A count that rounds to 1000k is shown as 1M.
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  const thousands = Math.round(n / 100) / 10
  if (thousands < 1000) return `${thousands}k`
  return `${Math.round(n / 100_000) / 10}M`
}

// The largest whole unit that fits, cut off rather than rounded: 45s, 26m, 1h 5m, 2h.
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// The state's own name, except that a stopped agent whose tool still runs says so.
export function statusLabel(row: AgentRow): string {
  return row.status === 'stopping' ? 'stopping (a tool is still running)' : row.status
}

// A row is working while it runs, or while a stopped agent's tool still does.
export const isWorking = (row: AgentRow): boolean => row.status === 'running' || row.status === 'stopping'

// The one-line status: the working agents with their tokens and longest time, then the warnings.
// Undefined when no agent is working and there is no warning.
export function statusLine(rows: readonly AgentRow[], warnings: number, now: number): string | undefined {
  const working = rows.filter(isWorking)
  if (working.length === 0) return warnings > 0 ? `reinwatch: ${plural(warnings, 'warning')}` : undefined
  const tokens = working.reduce((sum, row) => sum + newTokens(row.tokens), 0)
  const longest = working.reduce((most, row) => Math.max(most, activeMs(row, now)), 0)
  const line = `agents ${working.length} running · ${formatTokens(tokens)} tok · ${formatDuration(longest)} active`
  return warnings > 0 ? `${line} · ${plural(warnings, 'warning')}` : line
}

export function summaryLine(s: TurnSummary, longestLabel: string): string {
  return `${plural(s.agents, 'agent')} · ${formatTokens(s.tokens)} tok · ${formatDuration(s.activeMs)} active combined · longest: "${longestLabel}" ${formatDuration(s.longest.activeMs)} active`
}
