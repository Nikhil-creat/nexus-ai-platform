# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private reporting:
**Security tab → Report a vulnerability** on this repository. Include the affected file, steps to reproduce and the impact.

You can expect an acknowledgement within a few days. This is a personal project, so there is no formal SLA, but valid reports will be fixed and credited.

## Scope

In scope: authentication, authorization, the audit chain, PII masking, the SQL and prompt guards, sandbox escapes, container configuration and secrets handling.

Out of scope: the demo login and sample data (intentionally weak), and findings that require an already compromised host.

## Handling secrets

- Never commit `.env`. It is ignored by `.gitignore`.
- Rotate `JWT_SECRET` and any API key that was ever pushed.
- Generate secrets with `openssl rand -hex 32`.

## Supported versions

Only the latest commit on `main` is supported.
