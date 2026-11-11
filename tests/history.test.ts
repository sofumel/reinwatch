import { expect, test } from 'claude-code/testing'
import { addTurn, dayOf, HISTORY_KEY, localTime, parseDays, totals } from '../hooks/history.ts'
import type { Summary, TurnSummary } from '../types'
import { end, mountPane, readState, readStore, seedStore, spawn, standIns, start, step, tool, turn } from './helpers.ts'

const now = Date.UTC(2026, 10, 3, 12)
const DAY = 86_400_000
const SEC = 1000
// The day a clock reading falls on for the person, so no test depends on the machine's time zone.
const localDay = (t: number): string => dayOf(localTime(t))
const s: TurnSummary = { agents: 2, newAgents: 2, tokens: 1500, activeMs: 4000, longest: { id: 'a', activeMs: 3000 } }
const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' }

test('a turn adds to today', () => {
  expect(HISTORY_KEY).toBe('days-v2')
  expect(dayOf(now)).toBe('2026-11-03')
  const once = addTurn([], s, now)
  expect(once).toEqual([{ day: '2026-11-03', agents: 2, tokens: 1500, activeMs: 4000 }])
  expect(addTurn(once, s, now)).toEqual([{ day: '2026-11-03', agents: 4, tokens: 3000, activeMs: 8000 }])
})

test('days older than 30 days are dropped', () => {
  const old = { day: '2026-10-03', agents: 1, tokens: 1, activeMs: 1 }
  const kept = { day: '2026-10-06', agents: 1, tokens: 1, activeMs: 1 }
  const out = addTurn([old, kept], s, now)
  expect(out.map(d => d.day)).toEqual(['2026-10-06', '2026-11-03'])
  expect(Object.keys(out[0]!).sort()).toEqual(['activeMs', 'agents', 'day', 'tokens'])
  expect(totals([old, kept], now)).toEqual({ agents: 1, tokens: 1, activeMs: 1 })
  expect(now - 29 * DAY).toBe(Date.UTC(2026, 9, 5, 12))
})

test('garbage in the store reads as empty', () => {
  for (const raw of [null, 'x', [{ day: 'bad', agents: 1, tokens: 1, activeMs: 1 }], [{ day: '2026-11-01', agents: '3', tokens: 1, activeMs: 1 }]])
    expect(parseDays(raw)).toEqual([])
  expect(parseDays([{ day: '2026-11-01', agents: -1, tokens: 1, activeMs: 1 }, { day: '2026-11-02', agents: 1, tokens: 1, activeMs: 1 }]).length).toBe(1)
})

test('totals add up the kept days', () => {
  const days = [{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100 }, { day: '2026-11-02', agents: 2, tokens: 20, activeMs: 200 }]
  expect(totals(days, now)).toEqual({ agents: 3, tokens: 30, activeMs: 300 })
})

test('a main turn that ran agents leaves a summary and stores numbers only', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'Secret project Zephyr' })
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  const run = tool($, 'a1', 'sleep 2000')
  await clock.advance(2 * SEC)
  await run
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  const summary = await readState($, 'summary') as { text: string; at: number }
  expect(summary.text.startsWith('1 agent · ')).toBe(true)
  expect(summary.text).toContain('"Secret project Zephyr"')
  const stored = await readStore($, 'days-v2') as Record<string, unknown>[]
  expect(JSON.stringify(stored)).not.toContain('Zephyr')
  expect(stored.length).toBe(1)
  for (const d of stored) expect(Object.keys(d).sort()).toEqual(['activeMs', 'agents', 'day', 'tokens'])
  expect(stored[0]).toEqual({ day: localDay(Date.UTC(2026, 10, 5, 12)), agents: 1, tokens: 1200, activeMs: 2000 })
  expect(await readState($, 'history')).toEqual({ agents: 1, tokens: 1200, activeMs: 2000 })
})

test('the stored day holds new tokens, not cache reads', async ($, on) => {
  const { setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage({ ...usage, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 30 })
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(Date.UTC(2026, 10, 5, 12)), agents: 1, tokens: 1230, activeMs: 0 }])
})

test('no summary when no agent ran', async ($, on) => {
  standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toBeUndefined()
})

test('the stored days become the totals when the session starts', async ($, on) => {
  standIns(on)
  seedStore('days-v2', [{ day: localDay(0), agents: 3, tokens: 4500, activeMs: 6000 }])
  await start($)
  expect(await readState($, 'history')).toEqual({ agents: 3, tokens: 4500, activeMs: 6000 })
})

test('work done between main turns is counted once: in the next summary and in the store', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  // A background agent works while the main conversation is idle.
  await clock.advance(SEC)
  await spawn($, 'bg', { description: 'Background job' })
  setUsage(usage)
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  const summary = await readState($, 'summary') as Summary | null
  expect(summary?.text).toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active')
  const once = [{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0 }]
  expect(await readStore($, 'days-v2')).toEqual(once)
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual(once)
})

test('Stop and Allow resume alone add nothing to the next summary', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 1.2k tok')
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  await ui.press({ key: 'a1/confirm' })
  await ui.press({ key: 'a1/resume' })
  await ui.unmount()
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0 }])
})

test('rows read back after a reload are not reported again; their new work is', async ($, on) => {
  const { setUsage } = standIns(on)
  const stored = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 5000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 5000, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  // Only the read-back gets the stored rows; the mod's later writes read the real value, so they go through.
  let isReadBack = true
  on('state.get', (_, e, next) => {
    if (e.key !== 'agents' || !isReadBack) return next(e)
    isReadBack = false
    return { value: { value: { shape: 'agents-1', value: { old: stored } }, version: 0 } }
  })
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toBeUndefined()
  setUsage({ ...usage, input_tokens: 100, output_tokens: 0 })
  await turn($, undefined, 'start')
  await turn($, 'old', 'start')
  await step($, 'old')
  await turn($, 'old', 'end')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 100 tok')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 0, tokens: 100, activeMs: 0 }])
})

test('a row read back with cache reads is reported by its new tokens, so later work still counts', async ($, on) => {
  const { setUsage } = standIns(on)
  const stored = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 5000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 5000, cacheWrite: 0, cacheRead: 90_000, output: 0 }, turns: 1, failStreak: 0,
  }
  let isReadBack = true
  on('state.get', (_, e, next) => {
    if (e.key !== 'agents' || !isReadBack) return next(e)
    isReadBack = false
    return { value: { value: { shape: 'agents-1', value: { old: stored } }, version: 0 } }
  })
  await start($)
  setUsage({ ...usage, input_tokens: 100, output_tokens: 0 })
  await turn($, undefined, 'start')
  await turn($, 'old', 'start')
  await step($, 'old')
  await turn($, 'old', 'end')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 100 tok')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 0, tokens: 100, activeMs: 0 }])
})

test('the session end stores what no summary reported, and leaves the band alone', async ($, on) => {
  const { setUsage } = standIns(on)
  await start($)
  await spawn($, 'bg')
  setUsage(usage)
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await end($)
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0 }])
  expect(await readState($, 'summary')).toBeUndefined()
  // After a /clear the process goes on: what the end stored is not reported again.
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0 }])
})

test('parseDays merges entries of the same day by summing', () => {
  expect(parseDays([{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100 }, { day: '2026-11-02', agents: 5, tokens: 5, activeMs: 5 },
    { day: '2026-11-01', agents: 2, tokens: 20, activeMs: 200 }]))
    .toEqual([{ day: '2026-11-01', agents: 3, tokens: 30, activeMs: 300 }, { day: '2026-11-02', agents: 5, tokens: 5, activeMs: 5 }])
})

test('days dated after today are kept by addTurn and ignored by totals', () => {
  const future = { day: '2026-11-09', agents: 9, tokens: 9, activeMs: 9 }
  const past = { day: '2026-11-01', agents: 1, tokens: 1, activeMs: 1 }
  expect(addTurn([past, future], s, now).map(d => d.day)).toEqual(['2026-11-01', '2026-11-03', '2026-11-09'])
  expect(totals([past, future], now)).toEqual({ agents: 1, tokens: 1, activeMs: 1 })
})

test('localTime moves a clock reading by the zone offset, so a day is the local day', () => {
  const late = Date.UTC(2026, 10, 9, 23, 30)
  expect(dayOf(localTime(late, -540))).toBe('2026-11-10')
  expect(dayOf(localTime(late, 0))).toBe('2026-11-09')
  expect(localTime(late, 60)).toBe(late - 60 * 60_000)
  expect(localTime(late)).toBe(late - new Date(late).getTimezoneOffset() * 60_000)
})

test('the day stored, and the 30 days summed, are the local ones', async ($, on) => {
  // A moment whose local day differs from its UTC day in this zone, east or west of UTC.
  const late = new Date().getTimezoneOffset() > 0 ? Date.UTC(2026, 10, 10, 0, 30) : Date.UTC(2026, 10, 9, 23, 30)
  const { setUsage } = standIns(on, [], { now: late })
  seedStore('days-v2', [{ day: dayOf(localTime(late - 3 * DAY)), agents: 1, tokens: 10, activeMs: 100 }])
  await start($)
  expect(await readState($, 'history')).toEqual({ agents: 1, tokens: 10, activeMs: 100 })
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  const days = await readStore($, 'days-v2') as { day: string }[]
  expect(days.at(-1)?.day).toBe(dayOf(localTime(late)))
  expect(await readState($, 'history')).toEqual({ agents: 2, tokens: 1210, activeMs: 100 })
  // The session end stores the same day.
  await spawn($, 'bg')
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await end($)
  expect(((await readStore($, 'days-v2')) as { day: string }[]).map(d => d.day)).toEqual([dayOf(localTime(late - 3 * DAY)), dayOf(localTime(late))])
})
