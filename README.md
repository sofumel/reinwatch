<a id="reinwatch"></a>
<h1 align="center">reinwatch</h1>

<p align="center">
  <a href="https://github.com/sofumel/reinwatch/actions/workflows/ci.yml"><img src="https://github.com/sofumel/reinwatch/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/sofumel/reinwatch/stargazers"><img src="https://img.shields.io/github/stars/sofumel/reinwatch?style=flat" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/sofumel/reinwatch" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-mod-D97757" alt="Claude Code mod">
  <img src="https://img.shields.io/badge/Claude%20Code-2.1.300%2B-555" alt="Requires Claude Code 2.1.300+">
  <img src="https://img.shields.io/badge/TypeScript-hooks%20module-3178C6" alt="TypeScript hooks module">
</p>

<p align="center"><em>A token and runaway watchdog for the subagents, teammates and workflow agents Claude Code runs: per-agent tokens, warnings, notifications and history, with a way to stop one.</em></p>

<p align="center">
  <a href="#reinwatch">🇺🇸 English</a> · <a href="#japanese">🇯🇵 日本語</a><br>
  <a href="CONTRIBUTING.md">Contributing</a> · <a href="LICENSE">License (MIT)</a>
</p>

## Why

Claude Code's background tasks view lists tasks with elapsed time, opens their transcripts and stops them. reinwatch adds:

- Per-agent new-token counts (split under **Details**) and active time that counts model and tool work only.
- Warnings when an agent runs away or looks stuck, raised as notifications, plus a summary after each turn and 30-day totals.
- **Stop**, also for one agent inside a workflow, and **Ask to stop**. Nothing is stopped automatically.

## What you see

- **Status line:** `agents 2 running · 310k tok · 26m active`, with `· 1 warning` when one is open (`reinwatch: 1 warning` when no agent works).
- **`/reinwatch` pane:** one row per agent (state, name, tokens, active time, type, model, turns) with its buttons, the open warnings, the latest summary and `Last 30 days: 12 agents · 1.1M tok · 3h active`.
- **Band above the prompt:** the open warnings with their buttons, and after each turn `3 agents · 420k tok · 14m active combined · longest: "Explore the repo" 9m active`.

## Warnings and settings

| Warning | Fires when | Setting | Default |
|---|---|---|---|
| Long run | one agent has worked longer than the limit | `activeMinutes` | 30 |
| Tokens | one agent has taken in more new tokens than the limit | `tokenMillions` | 1 |
| Repeat | one agent makes the same tool call with the same input this many times | `repeatCount` | 5 |
| Failures | one agent has this many tool failures in a row | `failStreak` | 5 |
| Burst | this many agents start within the window | `burstCount`, `burstMinutes` | 10 in 2 minutes |
| Workflow run | one workflow run starts this many agents | `burstCount` | 10 |

Also `notify` (true), `openPaneOnWarning` (false) and `redact` (true: mask key-like text in descriptions). Set them in the plugin's options; minutes and millions may be fractional (`0.5`).

Token counts are new tokens: input, cache writes and output. Cache reads are left out of the counts and the token warning and shown only under **Details**. In the terminal, warnings also reach the terminal's own notifications; in the desktop app they show only through your own `Notification` hook: see [docs/notifications.md](docs/notifications.md).

## Install

```
/plugin install reinwatch --marketplace sofumel/reinwatch
```

Requires Claude Code 2.1.300 or later, in the terminal or the desktop app's Code tab.

## Stopping and privacy

- **Stop** denies the agent's new tool calls and answers its next model call with a reply telling it to report and not resume. A running tool finishes first (the row reads `stopping (a tool is still running)`), **Allow resume** lifts the stop, and stopping one agent does not stop its workflow.
- No network access, shell commands or model calls. Only the 30-day store (per local day: agents, new tokens, active milliseconds) outlives the session; prompts, outputs and tool inputs are never kept, and a tool input becomes only an in-memory hash to spot repeats.
- `redact` replaces key-like text with `[redacted]` by its look alone: a guard against accidents, not a guarantee.

## Limitations

- Time counts only while a model or tool call is open. In the terminal, a call that waits for your approval stops counting at the prompt and is not counted after you approve (nothing marks the answer); in the desktop app the wait counts.
- **View** works only in the terminal. **View** and **Ask to stop** need the agent in Claude Code's agent list, which workflow agents are not in.
- After a mod reload, a row can read "running" until the agent list (checked every 10 seconds) reports it done (workflow rows: until the session ends), and work since the last summary is missing from the 30-day totals.

## Contributing

Setup, tests and the engine's rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

---

<a id="japanese"></a>
<details>
<summary><b>日本語</b></summary>

### なぜ使うのか

Claude Code のバックグラウンドタスク画面では、タスクの一覧と経過時間の確認、記録の表示、停止ができます。reinwatch はそこに次を加えます。

- エージェントごとの新規トークン数（内訳は **Details**）と、モデルとツールが動いていた時間だけを数える実稼働時間。
- エージェントの暴走や行き詰まりを知らせる警告（通知でも届きます）、ターンごとのまとめ、30 日分の合計。
- **Stop**（ワークフロー内の 1 体にも使えます）と **Ask to stop**。自動で止めることはありません。

### 表示されるもの

- **ステータス行:** `agents 2 running · 310k tok · 26m active`。警告があると `· 1 warning` が付き、動いているエージェントがいなければ `reinwatch: 1 warning` になります。
- **`/reinwatch` の一覧:** エージェントごとの行（状態・名前・トークン・実稼働時間・種類・モデル・ターン数）とボタン、開いている警告、最新のまとめ、`Last 30 days: 12 agents · 1.1M tok · 3h active`。
- **入力欄の上の帯:** 開いている警告とボタン。ターンの終わりには `3 agents · 420k tok · 14m active combined · longest: "Explore the repo" 9m active`。

### 警告と設定

| 警告 | 出る条件 | 設定 | 既定値 |
|---|---|---|---|
| Long run | 1 体の実稼働時間が上限を超えた | `activeMinutes` | 30 |
| Tokens | 1 体の新規トークンが上限を超えた | `tokenMillions` | 1 |
| Repeat | 1 体が同じ入力で同じツールをこの回数呼んだ | `repeatCount` | 5 |
| Failures | 1 体のツールの失敗がこの回数続いた | `failStreak` | 5 |
| Burst | 期間内にこの数のエージェントが起動した | `burstCount`, `burstMinutes` | 2 分で 10 |
| Workflow run | 1 回のワークフロー実行がこの数のエージェントを起動した | `burstCount` | 10 |

ほかに `notify`（true）、`openPaneOnWarning`（false）、`redact`（true: 説明文のキーらしい文字列を伏せる）があります。設定はプラグインのオプションで変えられ、分と百万の値には小数（`0.5`）も使えます。

トークン数は新規トークン（入力・キャッシュ書き込み・出力）です。キャッシュ読み込みは数にもトークン警告にも含めず、**Details** にだけ表示します。ターミナルでは警告がターミナル自身の通知にも届きます。デスクトップアプリでは、自分で設定した `Notification` フックを通したときだけ表示されます（[docs/notifications.md](docs/notifications.md) を参照）。

### インストール

```
/plugin install reinwatch --marketplace sofumel/reinwatch
```

Claude Code 2.1.300 以降が必要です（ターミナル、またはデスクトップアプリの Code タブ）。

### 停止とプライバシー

- **Stop** は、エージェントの新しいツール呼び出しを拒否し、次のモデル呼び出しには途中経過を報告して再開しないよう伝える返答を返します。実行中のツールは最後まで動き（行は `stopping (a tool is still running)` と表示）、**Allow resume** で停止を解除できます。1 体を止めても、そのワークフローは止まりません。
- ネットワーク、シェルコマンド、モデル呼び出しは使いません。セッションをまたいで残るのは 30 日分の記録（現地の日ごとの、エージェント数・新規トークン数・実稼働ミリ秒）だけです。プロンプト、出力、ツールの入力は保存せず、ツールの入力は繰り返しを見つけるためのメモリ上のハッシュにするだけです。
- `redact` は、見た目だけを手がかりにキーらしい文字列を `[redacted]` に置き換えます。うっかり漏れるのを防ぐためのもので、保証ではありません。

### 制限事項

- 時間は、モデルかツールの呼び出しが開いている間だけ数えます。ターミナルでは、許可を待つ呼び出しは確認が出た時点で数えるのを止め、許可した後も数えません（答えた瞬間を示すものがないため）。デスクトップアプリでは待ち時間も数えます。
- **View** はターミナルでだけ使えます。**View** と **Ask to stop** は、エージェントが Claude Code のエージェント一覧に載っている必要があり、ワークフローのエージェントは載りません。
- mod を読み直したあと、行が「running」のままになることがあります。エージェント一覧（10 秒ごとに確認）が終了を伝えるまで続き、ワークフローの行はセッションが終わるまで続きます。直前のまとめ以降の作業は 30 日分の合計に入りません。

### 貢献

環境の準備、テスト、エンジンの決まりは [CONTRIBUTING.md](CONTRIBUTING.md) にあります（英語）。

### ライセンス

MIT。[LICENSE](LICENSE) を参照してください。

</details>
