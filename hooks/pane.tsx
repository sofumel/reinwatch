import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'
import type { AgentRow, Alert, Summary, Totals } from '../types'
import { ASK_TO_STOP, ASKED_TOAST, cannotMessage, cannotShow, hasMainView, isLive, masker, type ListCache, type WatchActions } from './actions.ts'
import { clean } from './clean.ts'
import { formatDuration, formatTokens, isWorking, label, plural, statusLabel } from './format.ts'
import { activeMs, newTokens } from './tracker.ts'

export const PANE_ID = 'reinwatch'
export const PANE_TITLE = 'reinwatch'

// The engine scrolls the pane, so every agent row is drawn up to this many; the rest is one "+k more" line.
const MAX_ROWS = 200

// Twins of the atoms register.tsx declares (same ref, initial value and shape tag): the engine refuses imported atoms.
const agentsAtom = atom({ plugin: 'reinwatch', key: 'agents' } as const, {} as Record<string, AgentRow>, { shape: 'agents-1' })
const alertsAtom = atom({ plugin: 'reinwatch', key: 'alerts' } as const, [] as Alert[], { shape: 'alerts-1' })
const dismissedAtom = atom({ plugin: 'reinwatch', key: 'dismissed' } as const, [] as string[])
const summaryAtom = atom({ plugin: 'reinwatch', key: 'summary' } as const, null as Summary | null, { shape: 'summary-1' })
const historyAtom = atom({ plugin: 'reinwatch', key: 'history' } as const, { agents: 0, tokens: 0, activeMs: 0 } as Totals, { shape: 'history-1' })
// The pane's own: the agent whose Stop awaits a yes, and the agent whose token breakdown is open.
const confirmAtom = atom({ plugin: 'reinwatch', key: 'confirm' } as const, null as string | null)
const expandedAtom = atom({ plugin: 'reinwatch', key: 'expanded' } as const, null as string | null)

type Line =
  | { kind: 'warning'; alert: Alert }
  | { kind: 'summary'; text: string; key: string }
  | { kind: 'head'; text: string; key: string }
  | { kind: 'row'; row: AgentRow }

// Working agents first, and the longest worker first among them.
const byWork = (now: number) => (a: AgentRow, b: AgentRow): number =>
  Number(isWorking(b)) - Number(isWorking(a)) || activeMs(b, now) - activeMs(a, now)

// The lines of the list in order: agents outside a workflow, then each run under its own heading.
function lines(all: AgentRow[], now: number): Line[] {
  const sorted = [...all].sort(byWork(now))
  const out: Line[] = sorted.filter(row => row.runId === undefined).map(row => ({ kind: 'row', row }))
  const runs: string[] = []
  for (const row of sorted) if (row.runId !== undefined && !runs.includes(row.runId)) runs.push(row.runId)
  for (const runId of runs) {
    const members = sorted.filter(row => row.runId === runId)
    out.push({ kind: 'head', key: `head:${runId}`, text: clean(`workflow ${runId} · ${plural(members.length, 'agent')} · ${members.filter(isWorking).length} running`) })
    for (const row of members) out.push({ kind: 'row', row })
  }
  return out
}

// The engine takes only a function literal as a hook, so the render hook is written here, inside the call that registers it.
export function registerPane(on: On, actions: WatchActions, isMasking: () => boolean, listCache: ListCache): void {
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const agents = await read($, agentsAtom)
    const alerts = await read($, alertsAtom)
    const dismissed = await read($, dismissedAtom)
    const summary = await read($, summaryAtom)
    const history = await read($, historyAtom)
    const confirm = await read($, confirmAtom)
    const expanded = await read($, expandedAtom)
    const now = await $.clock.now()
    const hasView = hasMainView(e.surface)
    const listed = new Map<string, { description: string; type: string }>()
    let agentList = listCache.get(now)
    if (agentList === null) {
      agentList = await $.agent.list().catch(() => null)
      if (agentList !== null) listCache.put(now, agentList)
    }
    for (const info of agentList ?? []) listed.set(info.id, info)

    const all = Object.values(agents)
    const working = all.filter(isWorking).length
    const heading = `${working} running · ${plural(all.length, 'agent')} · ${formatTokens(all.reduce((sum, row) => sum + newTokens(row.tokens), 0))} tok this session`
    const past = history.agents > 0 || history.tokens > 0
      ? `Last 30 days: ${plural(history.agents, 'agent')} · ${formatTokens(history.tokens)} tok · ${formatDuration(history.activeMs)} active`
      : null

    // What a person calls an agent: its own description, else the engine's list. Masked when drawn, so text recorded
    // while masking was off is masked once it is on.
    const typeOf = (row: AgentRow): string => row.type || listed.get(row.id)?.type || ''
    const mask = masker(isMasking)
    const nameOf = (row: AgentRow): string =>
      label({ id: row.id, description: mask(row.description || listed.get(row.id)?.description || ''), type: typeOf(row) })
    const fromOf = (row: AgentRow): string => {
      if (row.runId !== undefined) return 'workflow'
      if (row.parentId === undefined) return 'main'
      const parent = agents[row.parentId]
      return parent === undefined ? `agent ${row.parentId.slice(0, 8)}` : nameOf(parent)
    }

    // Under the heading, the open warnings (newest first) and then the latest summary, so both can be read and dismissed
    // here as in the band. View, Ask to stop and Stop stay on the agents' own rows.
    const notes: Line[] = alerts.filter(a => !dismissed.includes(a.key)).reverse().map((alert): Line => ({ kind: 'warning', alert: { ...alert, text: mask(alert.text) } }))
    const summaryKey = summary === null ? '' : `summary:${summary.at}`
    if (summary !== null && !dismissed.includes(summaryKey)) notes.push({ kind: 'summary', text: mask(summary.text), key: summaryKey })
    // Every agent row is drawn up to MAX_ROWS (the warnings and the summary stay on top); what is beyond is counted as hidden
    // agents only. A workflow heading goes with its first drawn row. A stopped agent (its only Allow resume) and the agent
    // with a pending Stop confirm are always drawn: past the cap they follow the "+k more" line, not counted in k.
    const shown: Line[] = [...notes]
    const kept: Line[] = []
    let drawn = 0
    let hidden = 0
    for (const line of lines(all, now)) {
      if (line.kind !== 'row') { if (drawn < MAX_ROWS) shown.push(line) } else if (drawn < MAX_ROWS) { shown.push(line); drawn += 1 }
      else if (line.row.isStopped || line.row.id === confirm) kept.push(line)
      else hidden += 1
    }

    return (
      <Box flexDirection="column" gap="sm">
        <Text bold>{heading}</Text>
        {past !== null && <Text dimColor>{past}</Text>}
        {all.length === 0 && <Text dimColor>No agents yet in this session.</Text>}
        {[...shown, ...(hidden > 0 ? [{ kind: 'more' as const }] : []), ...kept].map(line => {
          if (line.kind === 'more') return <Box key="more"><Text dimColor>{`+${hidden} more`}</Text></Box>
          if (line.kind === 'warning') {
            const key = line.alert.key
            return (
              <Box key={`warning:${key}`} gap="sm" flexWrap="wrap">
                <Text>{`! ${line.alert.text}`}</Text>
                <Button key={`${key}/dismiss`} label="Dismiss" onPress={async () => { await actions.dismiss(key) }} />
              </Box>
            )
          }
          if (line.kind === 'summary') {
            const key = line.key
            return (
              <Box key={key} gap="sm" flexWrap="wrap">
                <Text dimColor>{line.text}</Text>
                <Button key="summary/dismiss" label="Dismiss" onPress={async () => { await actions.dismiss(key) }} />
              </Box>
            )
          }
          if (line.kind === 'head') return <Box key={line.key}><Text bold>{line.text}</Text></Box>
          const row = line.row
          const id = row.id
          const name = nameOf(row)
          const isListed = listed.has(id)
          const live = isLive(row)
          const text = clean(`${statusLabel(row)} · ${name} · ${formatTokens(newTokens(row.tokens))} tok · ${formatDuration(activeMs(row, now))} active · ${clean(typeOf(row)) || '?'} · ${clean(row.model) || '?'} · ${plural(row.turns, 'turn')} · from ${fromOf(row)}`)
          return (
            <Box key={`row:${id}`} flexDirection="column" gap="sm">
              <Text>{text}</Text>
              <Box gap="sm" flexWrap="wrap">
                {isListed && hasView && (
                  <Button key={`${id}/view`} label="View" onPress={async () => {
                    const shownView = await $.ui.view({ agentId: id })
                    if (shownView.deny !== undefined) await $.ui.toast(cannotShow(shownView.deny))
                  }} />
                )}
                {isListed && live && (
                  <Button key={`${id}/ask`} label="Ask to stop" onPress={async () => {
                    const sent = await $.session.send({ to: { agentId: id }, text: ASK_TO_STOP })
                    await $.ui.toast(sent.isDelivered ? ASKED_TOAST : cannotMessage(sent.reason))
                  }} />
                )}
                {live && confirm !== id && (
                  <Button key={`${id}/stop`} label="Stop" onPress={async () => { await update($, confirmAtom, () => id) }} />
                )}
                {live && confirm === id && <Text>{`Stop "${name}"? Running tools finish first.`}</Text>}
                {live && confirm === id && (
                  <Button key={`${id}/confirm`} label="Yes, stop" onPress={async () => {
                    await actions.stop(id)
                    await update($, confirmAtom, () => null)
                  }} />
                )}
                {live && confirm === id && (
                  <Button key={`${id}/cancel`} label="Cancel" onPress={async () => { await update($, confirmAtom, () => null) }} />
                )}
                {row.isStopped && (
                  <Button key={`${id}/resume`} label="Allow resume" onPress={async () => { await actions.resume(id) }} />
                )}
                <Button key={`${id}/details`} label={expanded === id ? 'Hide details' : 'Details'}
                  onPress={async () => { await update($, expandedAtom, current => (current === id ? null : id)) }} />
              </Box>
              {expanded === id && (
                <Text dimColor>{`in ${formatTokens(row.tokens.input)} · cache write ${formatTokens(row.tokens.cacheWrite)} · cache read ${formatTokens(row.tokens.cacheRead)} · out ${formatTokens(row.tokens.output)}`}</Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
