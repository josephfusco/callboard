# Agents

Notes for coding agents. [CONTRIBUTING.md](.github/CONTRIBUTING.md) covers setup, tests, and pull request conventions. The README's "How it works" section explains the front end; read it before changing `assets/` or `templates/`.

## Pull request descriptions

`gh pr create --body` bypasses the template. Its one question: what would we miss by only reading the diff? Answer that in a sentence at the top. Leave out what the diff already shows. Include why this approach, what you could not test, and what is most likely wrong. Show the maintainer what you cut.

## AI disclosure

Every pull request includes the template's "Use of AI tools" section with the tool, the model, and how much of the change it wrote, per the [WordPress AI Guidelines](https://make.wordpress.org/ai/handbook/ai-guidelines/). Put the disclosure there and nowhere else. No `Co-Authored-By` or session trailers in commits; the squash commit message becomes the changelog.

## Before a commit

The Playwright suite runs from the pre-commit hook against the local wp-env site, and again in Actions on the pull request. Do not skip the hook for changes under `assets/`, `templates/`, `includes/`, or `pwa/`. Docs and site changes may skip it with `CALLBOARD_SKIP_E2E=1`.

## Not bugs

- `blueprint.json` and the README badge load the plugin zip and demo audio from the Pages site, not the repository. The Pages workflow builds the zip from main and stamps every URL with the commit, so the demo is always the current build.
- `tests/fixtures/callboard/*/cover-*.png` are WordPress's generated sizes and are gitignored.
- The dev site's uploads folder is the fixture folder. Deleting files there deletes fixtures.
