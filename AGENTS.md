# Agents

Guidance for coding agents working in this repository. [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) covers local setup, the test commands, and the pull request conventions, and all of it applies here too. The [README](README.md) explains how the plugin is built and why; read its "How it is built" section before changing the front end.

## Pull request descriptions

`gh pr create --body` skips the pull request template, so an agent never sees the question it asks. It is this:

> What would we miss by only reading the diff?

One sentence, at the top of the description. Cut what is already on the page: what the code does, a file-by-file summary, results the checks report. Keep what is nowhere in the repository: why this approach, what you could not test, the part most likely to be wrong.

Then show the person you are working with that sentence and what you cut, so they can put back anything only they know.

## AI disclosure

Every pull request carries the template's "Use of AI tools" section, filled in: the tool, the model, and how much of the change it wrote. This follows the [WordPress AI Guidelines](https://make.wordpress.org/ai/handbook/ai-guidelines/). The disclosure lives in that section and nowhere else: no `Co-Authored-By` or session trailers in commit messages, because the squash commit's message becomes the changelog.

## Before a commit

The Playwright suite runs from the pre-commit hook against the local wp-env tests site and does not run in Actions. Run it; do not skip it for changes to `assets/`, `templates/`, `includes/`, or `pwa/`. Docs-only and site-only commits may skip it with `CALLBOARD_SKIP_E2E=1`.

## Things that look wrong but are not

- `blueprint.json` and the README badge fetch the plugin zip and the demo audio from the Pages origin, not from the repository, so the Playground demo works while the repository is private.
- `tests/fixtures/callboard/*/cover-*.png` are WordPress's intermediate sizes, generated when a dev site imports the fixtures. They are ignored on purpose.
- The dev site's uploads folder is the fixture folder. Deleting files there deletes fixtures.
