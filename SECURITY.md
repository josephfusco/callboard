# Security Policy

Callboard is a small plugin for a private cast site, but it renders a public front end, serves audio, and sends Web Push, so it deserves a real disclosure path.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security reports.

Use [GitHub Security Advisories](https://github.com/josephfusco/callboard/security/advisories/new) to report privately. Expect an acknowledgement within 72 hours and a patched release within 14 days of that, faster if the issue is being exploited.

## Scope

In scope: the plugin's PHP, JavaScript, CSS, service worker, blueprint, and the CI workflows in this repository.

Out of scope: WordPress core itself (report to [HackerOne](https://hackerone.com/wordpress)), hosting-layer issues, and the audio fetch tooling that runs on a maintainer's own machine.

## Supported versions

Only the most recent release receives security updates.

| Version | Supported |
| --- | --- |
| `1.3.x` | ✅ |
| `< 1.3` | ❌ |
