# Lume user guide

How to use Lume's features beyond plain terminal tabs. Shortcuts are written
with `Ctrl`; on macOS read `Cmd`.

- [Command palette](#command-palette)
- [Command history](#command-history)
- [Workspaces](#workspaces)
- [Remote control](#remote-control)
- [Lume ↔ Lume](#lume--lume)
- [SSH manager](#ssh-manager)
- [Inline AI](#inline-ai)
- [Settings reference](#settings-reference)

## Command palette

`Ctrl+Shift+P` opens one searchable list of everything Lume can do: tabs and
panes, layouts, workspaces, SSH hosts, workflows, remote control, themes,
settings.

- Type to filter. Every word must match, in any order; the search also reaches
  into the sub-lists (typing `nord` offers *Change theme › Nord*).
- Entries ending with `›` open a sub-list: `Enter` or `→` to go in, `Esc` or
  `Backspace` to go back.
- `Shift+Enter` runs an entry's variant when it has one (for a workspace: open it
  *without* its startup commands).
- The **Recent** section brings back the last five actions you ran.
- Two prefixes switch mode:
  - `!` searches the [command history](#command-history),
  - `?` asks the AI to generate a command (also offered as the last row for any
    free text).

## Command history

Every command that finishes in a pane is recorded locally in
`~/.config/lume/history.jsonl` (`%APPDATA%\lume\history.jsonl` on Windows) with
the folder it ran in, its exit code, its duration and the git branch. Nothing
leaves your machine. Recording needs the [shell integration](../README.md#shell-integration).

Search it with `Ctrl+Shift+H` (or `!` in the palette). Results are grouped per
command line, newest first, with how many times it ran.

| Filter | Keeps |
|---|---|
| `failed` / `failed:true` | non-zero exit codes |
| `ok` / `failed:false` | exit code 0 |
| `here` | commands run in the active pane's folder |
| `project:<text>` / `cwd:<text>` | folders containing `<text>` |
| `branch:<text>` | git branches containing `<text>` |

Any other word must appear in the command, e.g. `! failed project:api composer`.
`Enter` inserts the command at the prompt, `Shift+Enter` runs it.

**Privacy.** Commands starting with a space are never recorded. Settings →
History has a list of patterns that are never recorded either (by default
`*password*`, `*token*`, `*secret*`, `*api_key*`…), a switch to turn recording
off, and a *Clear* button.

## Workspaces

A workspace is a named set of tabs you reopen in one click: each tab's pane
layout, the folder of every pane, and optional **startup commands** (a dev
server, a queue worker…).

**Save** — click the `▾` next to the `+` of the tab bar → *Save as a workspace…*,
type a name, choose **This tab** or **All tabs**. Whatever runs in a pane at that
moment becomes its startup command. Saving under an existing name replaces that
workspace.

**Open** — click it in the `▾` menu or pick it in the palette. It opens as new
tabs next to the current ones. What happens to its startup commands is set in
Settings → Workspaces: run them, ask each time, or never. The struck-through `▶`
in the menu (or `Shift+Enter` in the palette) always opens without them.

**Manage** — hover a workspace in the `▾` menu: replace it with the current tabs,
edit its file, delete it.

Workspaces are plain YAML files in `~/.config/lume/workspaces/` — copy them to
another machine, version them, or write them by hand:

```yaml
name: PALR
tabs:
  - title: Dev
    layout:
      split: row          # row = side by side, column = stacked
      ratio: 0.5
      children:
        - cwd: ~/Projects/palr
          command: php artisan serve
        - cwd: ~/Projects/palr
          command: npm run dev
  - title: Queue
    layout:
      cwd: ~/Projects/palr
      command: php artisan queue:work
```

A tab holds at most four panes; extra panes in a file are ignored.

## Remote control

Drive this Lume's terminals from a phone, a browser or another Lume.

1. Right-click a terminal → **Remote control** (or *Start remote control* in the
   palette).
2. Scan the QR code with the device. That pairs it: the QR code is **single use
   and expires after 10 minutes**.
3. From then on the device reconnects with the plain address shown under
   *Paired devices* — no QR code needed. Pair another device with *New QR code*.

Every paired device is listed in the panel and in Settings → Remote, where it can
be revoked; revoking cuts its live connection immediately. *Stop remote control*
disconnects everyone.

**Network.** On the same network the device connects directly. When
`cloudflared` is installed, sharing also opens an Internet tunnel so devices
elsewhere can connect; turn *Internet tunnel automatically* off in Settings →
Remote to stay on the local network (the panel then offers a button to enable the
tunnel for one session).

**Security.** The session is end-to-end encrypted (NaCl secretbox): the local
network and the tunnel provider only see ciphertext. The pairing secret travels in
the QR code's URL fragment, which browsers never send over the network. One known
limit: on the local network the page itself is served over plain HTTP, so an
*active* attacker on that network could serve a modified page — see
[SECURITY.md](../SECURITY.md).

**On the phone.** A tab bar switches between the terminals of this Lume (every
pane is listed) and `+` opens a new one; a key row adds Esc, Tab, Ctrl, arrows
and common symbols; swipe horizontally on the terminal to move the cursor.

## Lume ↔ Lume

Open a terminal of another Lume (your desktop from your laptop, say) in a pane:

1. On the other Lume, start remote control and click *Copy* under the QR code.
2. On this Lume: palette → **Connect to another Lume…** → paste the link.

The pane shows the remote Lume's terminal. Palette → *Terminals of …* switches to
another of its terminals or opens a new one. The pairing is remembered: after a
network drop the pane reconnects by itself, a restart of Lume reconnects it, and a
new address of the same Lume (new tunnel, new IP) works without pairing again —
paste the plain address. Forget a Lume in Settings → Remote.

## SSH manager

`Ctrl+Shift+S` lists the hosts of `~/.ssh/config`, following `Include` lines;
type a `user@host` that isn't listed to connect to it directly. Lume runs your
own `ssh` with the host alias, so everything in your config (keys, `ProxyJump`,
forwards, agent) applies as usual.

- `Alt+F` — favorite: favorites, then recently used hosts, come first (in the
  palette too).
- `Alt+T` — **tmux**: re-attach the same remote tmux session each time, so what
  runs there survives a dropped connection. The session name and whether new
  hosts start with tmux on are in Settings → SSH.
- `Alt+M` — **mosh** (shown when mosh is installed): survives network changes
  and sleep.

When an SSH session drops (ssh exits with code 255), the pane offers
**Reconnect**.

## Inline AI

- **Explain a block** — the ✦ button of a block in the blocks panel. For a
  failed command it explains the error and suggests a fix. The *AI context*
  toggles at the bottom of the panel add the folder and git branch, and/or the
  previous block, to what is sent — both off by default.
- **Generate a command** — `?` in the palette, or type a request and pick the
  last row. `Enter` inserts the answer, `Shift+Enter` runs it.

Providers (Claude CLI, Codex CLI, OpenAI-compatible APIs…) are set in
Settings → AI.

## Settings reference

| Section | Setting | Default |
|---|---|---|
| Remote | Port | 4530 (a free port is used if taken) |
| Remote | Internet tunnel automatically | on (when cloudflared is installed) |
| Remote | Paired devices / other Lumes | revoke / forget |
| History | Record command history | on |
| History | Never record | `*password*`, `*passwd*`, `*secret*`, `*token*`, `*api_key*`, `*apikey*` |
| History | Keep blocks across restarts | on (last 30 per pane) |
| Workspaces | Startup commands | run them |
| SSH | tmux session name | `lume` |
| SSH | tmux by default for new hosts | off |
| General | Show the git branch on tabs | on |
