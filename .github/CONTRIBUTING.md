# Contributing

## Local development

```bash
npm install && composer install
npm run env:start          # WordPress at http://localhost:8890 (admin / password), fixtures imported
```

The plugin renders the whole front end and ships one stylesheet and one script with no build step. Keep it that way: transform and opacity animations only, no font-weight changes for state, native controls first.

Fetching from YouTube needs `yt-dlp` (and `ffmpeg` for mp3) wherever WP-CLI runs. `wp callboard doctor` tells you what is available.

## Running checks

```bash
npm run lint               # PHPCS (WordPress Coding Standards) + ESLint
npm run test:e2e           # Playwright, desktop + iPhone viewport (wp-env must be running)
```

CI runs the same PHPCS and ESLint, the Playwright suite, the WordPress.org Plugin Check against the built zip, a spell check, and lints the workflow files themselves. Docs-only changes skip the wp-env jobs.

## Pull requests

1. Branch off `main`.
2. Title the pull request as a [Conventional Commit](https://www.conventionalcommits.org/). Pull requests squash-merge with the title as the commit subject, so the title is what release-please reads. `lint-pr.yml` enforces this.
3. Fill in the template. The line at the top saying what we would miss by only reading the diff is the part that matters most.
4. Every pull request gets a sticky comment with a WordPress Playground link built from its own commit. Use it to check the change on a phone.

## Releases

Releases are automated by [release-please](https://github.com/googleapis/release-please). It reads the merged pull request titles on `main` to decide the next version and write `CHANGELOG.md`:

- `feat: ...` → minor bump
- `fix: ...` → patch bump
- `feat!: ...` or a `BREAKING CHANGE:` footer → major bump
- `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `build:`, `style:` → no version bump

release-please keeps a release pull request open on `main`. Merging it tags the release, publishes a GitHub Release, and attaches `callboard.zip` built from `.distignore`.

<details>
<summary>Keeping the version numbers in step</summary>

`scripts/sync-versions.sh` reads the version from `.release-please-manifest.json` and updates the plugin header `Version:`, the `CALLBOARD_VERSION` constant, `readme.txt`'s `Stable tag:`, and `package.json`. The release-please workflow runs it on every release pull request; you can run it locally too:

```bash
bash scripts/sync-versions.sh
```

</details>

<details>
<summary>Why the release pull request has no CI</summary>

By default release-please opens its pull request with the workflow's own `GITHUB_TOKEN`, and events raised by that token never start other workflows. To get CI and a Playground preview on the release pull request, add a fine-grained personal access token with `contents` and `pull-requests` write on this repository as the `RELEASE_PLEASE_TOKEN` secret. `release-please.yml` prefers it when present.

</details>
