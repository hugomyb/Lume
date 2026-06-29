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

- **Remote control** — the HTTP/WebSocket server that mirrors a pane to another
  device (token auth, the served web page, the optional cloudflared tunnel).
- **AI providers** — handling of API keys and the commands spawned for CLI
  providers.
- **Shell integration & PTY** — anything that could lead to unintended command
  execution.

## Supported versions

Lume is pre-1.0 and ships from a single `main` line. Security fixes land in the
**latest release**; please make sure you're up to date (the app auto-updates)
before reporting.
