# Callboard

Rehearsal tracks for a cast. A WordPress plugin that turns a site into a small, private music app: sets of audio, a player that keeps playing while you move around, lock-screen controls, offline saving, Web Push notices, and an "Add to Home Screen" flow on iPhone. The plugin renders the whole front end, whatever theme is active, and keeps the site out of search engines.

- **Sets are posts.** Tracks are audio attachments, reordered and retitled in the set's edit screen. The featured image is the lock-screen cover.
- **Fetch from YouTube with WP-CLI** where `yt-dlp` exists: `wp callboard fetch '<url>' --name="Spring Show"`. Or queue URLs in the admin and run `wp callboard run`.
- **Import a folder** of audio plus `manifest.json` from `wp-content/uploads/callboard/<slug>/` on hosts that can't run binaries.
- **Notices.** The cast opts in from the home page; you send messages from Sets → Notices, and new sets announce themselves.
- **Settings** for the tagline, footer note, an emoji badge on the playing track, and the confetti text behind a triple tap on the title.

## WordPress Playground

No install needed. Launch a scratch site from `main` with a demo set already imported.

[![Launch in WordPress Playground](https://img.shields.io/badge/Launch-3858E9?style=for-the-badge&logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/josephfusco/callboard/main/blueprint.json)

Every pull request gets its own Playground link in a sticky comment, built from that PR's commit.

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) to run it locally with wp-env and the Playwright suite.

## Releases

Pull request titles are [Conventional Commits](https://www.conventionalcommits.org/), and [release-please](https://github.com/googleapis/release-please) turns them into the version, the changelog, and a GitHub Release with `callboard.zip` attached. Install that zip like any other plugin.

GPL-2.0-or-later.
