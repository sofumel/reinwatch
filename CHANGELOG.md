# Changelog

All notable changes to `reinwatch` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-11

Initial public release: a token and runaway watchdog for the subagents, teammates and workflow agents Claude Code runs. Requires Claude Code 2.1.300 or later, in the terminal or the desktop app's Code tab.

### Watch

- **Status line** — the working agents, their new tokens and the longest active time, plus the open warnings.
- **`/reinwatch` pane** — one row per agent (state, name, new tokens, active time, type, model, turns, where it came from), workflow agents grouped under their run, a token breakdown under **Details**, the open warnings, the latest turn summary and the last 30 days' totals.
- **Band above the prompt** — the open warnings with their buttons, and a summary after each turn.
- New tokens count input, cache writes and output; cache reads are shown only under **Details**. Active time counts only while a model or tool call is open.

### Warn

- **Long run**, **Tokens**, **Repeat** (the same tool call with the same input), **Failures** (tool failures in a row), **Burst** (many agents starting at once) and **Workflow run** warnings, each raised once and dismissable, with limits set in the plugin's options.
- Warnings are raised as notifications; in the desktop app they reach you through your own `Notification` hook (see `docs/notifications.md`).

### Stop

- **Stop** denies an agent's new tool calls and answers its next model call with a reply telling it to report and not resume; it also works for one agent inside a workflow, and it holds across a mod reload. **Allow resume** lifts it.
- **Ask to stop** sends the agent a message asking it to stop at the next safe point.
- Nothing is stopped automatically.

### Privacy

- No network access, shell commands or model calls. Only the 30-day numbers (agents, new tokens, active time per local day) outlive the session.
- Text from agents is shown on one plain line, and key-like text is masked (`redact`, on by default).
