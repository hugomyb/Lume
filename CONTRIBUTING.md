# Contributing to Lume

Thanks for your interest in improving Lume! This guide gets you from clone to a
green pull request.

Lume is a fast, lightweight terminal — **Rust + Tauri 2** (backend) and
**SolidJS + xterm.js** (frontend).

## Prerequisites

- **Rust** (stable) — install via [rustup](https://rustup.rs).
- **Node.js 20+** and npm.
- **Tauri 2 system dependencies.** On Debian/Ubuntu:

  ```bash
  sudo apt-get update && sudo apt-get install -y \
    libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
    libayatana-appindicator3-dev libxdo-dev patchelf
  ```

  For other platforms see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Setup & run

```bash
npm install          # install frontend deps
npm run tauri dev    # run the app with hot reload
```

To produce installable bundles (`.deb` / `.rpm` / AppImage):

```bash
npm run tauri build
```

## Before opening a PR

Please make sure all of these pass locally — CI runs the same checks:

```bash
# Frontend
npx tsc --noEmit         # type-check
npx vite build           # production build

# Backend (from src-tauri/)
cd src-tauri
cargo test               # unit tests
cargo fmt                # format (CI checks formatting)
cargo clippy             # lint
```

## Project structure

```
src/              SolidJS frontend
  Terminal.tsx      xterm.js wrapper (rendering, autocomplete, OSC, blocks)
  Tabs.tsx          tabs/panes, session state, top-level wiring
  Settings.tsx      settings UI
  i18n.ts, i18n/    translations (en is the source; keep all locales in sync)
  *.ts              feature modules (config, blocks, ssh, workflows, ...)
src-tauri/src/    Rust backend
  pty.rs            PTY spawning, output streaming, OSC parsing hook
  ai.rs             AI provider abstraction (CLI + API)
  remote.rs         remote-control HTTP/WebSocket server + mobile page
  config.rs         config (TOML) load/save, types
  osc.rs            OSC 133/7 parser
  ...
```

## Guidelines

- **Match the surrounding code** — naming, comment density, and idioms. Read the
  neighbouring file before adding to it.
- **Keep changes focused** — one feature/fix per PR. Smaller PRs review faster.
- **i18n:** `src/i18n.ts` (`en`) is the source of truth. If you add a UI string,
  add the key to `en` (and ideally the other locales); they must stay in sync
  (same key set). Preserve `{placeholders}` and HTML tags in translations.
- **No secrets** in code, history, or screenshots.
- **Discuss big changes first** — open an issue before large features or
  refactors so we can align on the approach.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/hugomyb/Lume/issues/new/choose).
For security vulnerabilities, **do not open a public issue** — see
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
