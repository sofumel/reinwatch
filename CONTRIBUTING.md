# Contributing

Thanks! Bug fixes, docs and features are all welcome.

**Philosophy**

- A watchdog, not an autopilot: reinwatch shows and warns, and stops an agent only when you press Stop.
- Nothing leaves your machine: no network access, shell commands or model calls, and nothing kept across sessions but the 30-day numbers.
- Plain functions, tested: tracking, warnings, text and history live in pure modules (`hooks/tracker.ts`, `alerts.ts`, `format.ts`, `history.ts`); `hooks/register.tsx` only wires them to Claude Code's events.

**Before you start**: for small fixes, just open a PR. For behavior changes or new features, open an issue first.

## Setup and tests

You need Claude Code 2.1.300 or later and `tsc`.

```sh
claude plugin test .               # run the tests in tests/
claude plugin validate --strict .  # check the plugin; lists every hook and $ call
tsc -p .                           # type-check (needs the API types the engine writes to .claude-plugin/types/ when the mod loads)
```

To try a checkout live, set `CLAUDE_CODE_PLUGIN_DIRS` to its folder; add `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` so desktop sessions reload on save. Add a test for any behavior change.

## Rules the engine enforces

- `$` is never stored, passed, returned or destructured: spell `$.noun.method(...)` inside the hook that received it.
- Hooks are function literals at the `on(...)` call, and one event takes at most one hook without a matcher.
- Atoms are declared in each file that uses them, as identical twins (same ref, initial value and shape tag).
- State values are frozen: copy them before you change them.

## Project rules

- Surfaces: the terminal and the desktop app's Code tab. VS Code is out of scope.
- UI text is English, and README claims stay true to the code.
- No real secrets in tests: build fake keys at runtime.

## Pull requests

Keep them small and focused. Say what and why, name the surface you tried it on, and include the test and validate results. CI runs validate and the tests on every PR; run `tsc -p .` yourself, since CI has no logged-in session to write the engine's types.

By contributing you agree your work is licensed under the project's [MIT License](LICENSE).
