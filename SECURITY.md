# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately via GitHub's
[**private vulnerability reporting**](https://github.com/hugomyb/Lume/security/advisories/new):

> Go to the repository's **Security** tab → **Report a vulnerability**.

Please include, as far as you can:

- a description of the vulnerability and its impact,
- the affected version (see `Settings → About`) and platform,
- step-by-step instructions to reproduce it, and
- any proof-of-concept or logs.

We'll acknowledge your report as quickly as we can, keep you updated on the fix,
and credit you in the release notes if you'd like.

## Scope notes

A few Lume features are inherently security-sensitive — reports about them are
especially welcome:

- **Remote control** — the HTTP/WebSocket server that mirrors panes to another
  device: QR pairing (one-time secret in the URL fragment), per-device keys and
  revocation, the end-to-end encrypted channel (NaCl secretbox, see
  `src-tauri/src/remote_proto.rs`), the served web page, the Lume ↔ Lume client
  and the optional cloudflared tunnel. Known limit: the page itself is served
  over plain HTTP on the LAN, so an *active* attacker on that network could
  serve a modified page; the encryption protects against passive sniffing and
  against the tunnel provider.
- **AI providers** — handling of API keys and the commands spawned for CLI
  providers.
- **Shell integration & PTY** — anything that could lead to unintended command
  execution.

## Supported versions

Lume is pre-1.0 and ships from a single `main` line. Security fixes land in the
**latest release**; please make sure you're up to date (the app auto-updates)
before reporting.
