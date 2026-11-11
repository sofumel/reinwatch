# Notifications in the desktop app

In the desktop app, reinwatch does not raise an operating-system notification itself. It raises a plugin notification (title `reinwatch`) that your own `Notification` hook receives. A hook's `command` is a single command line, so save one of the scripts below to a file and set `command` to the line that runs it. For example, in `~/.claude/settings.json` on Windows:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "plugin_notification",
        "hooks": [{ "type": "command", "command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\\path\\to\\reinwatch-notify.ps1\"" }]
      }
    ]
  }
}
```

The hook gets JSON on stdin with `message`, `title` and `notification_type`. Each script reads it and acts only when `notification_type` is `plugin_notification`. They are starting points; adapt them to your setup. The macOS and Linux scripts are untested.

**Windows (PowerShell).** Save this as `C:\path\to\reinwatch-notify.ps1`:

```powershell
$j = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($j.notification_type -eq 'plugin_notification') {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $n = New-Object System.Windows.Forms.NotifyIcon
  $n.Icon = [System.Drawing.SystemIcons]::Information
  $n.Visible = $true
  $n.ShowBalloonTip(5000, $j.title, $j.message, 'Info')
  Start-Sleep -Seconds 6; $n.Dispose()
}
```

Then set `command` to:

```json
"command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\\path\\to\\reinwatch-notify.ps1\""
```

**macOS (needs `jq`).** Save this as `/path/to/reinwatch-notify.sh`:

```sh
j=$(cat)
[ "$(printf '%s' "$j" | jq -r .notification_type)" = plugin_notification ] &&
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title (item 2 of argv)' -e 'end run' \
    "$(printf '%s' "$j" | jq -r .message)" "$(printf '%s' "$j" | jq -r .title)"
```

Then set `command` to:

```json
"command": "sh /path/to/reinwatch-notify.sh"
```

**Linux (needs `jq` and `notify-send`).** Save this as `/path/to/reinwatch-notify.sh`:

```sh
j=$(cat)
[ "$(printf '%s' "$j" | jq -r .notification_type)" = plugin_notification ] &&
  notify-send -- "$(printf '%s' "$j" | jq -r .title)" "$(printf '%s' "$j" | jq -r '.message | gsub("&"; "&amp;") | gsub("<"; "&lt;")')"
```

The message is escaped because many notification servers render markup in the body.

Then set `command` to:

```json
"command": "sh /path/to/reinwatch-notify.sh"
```
