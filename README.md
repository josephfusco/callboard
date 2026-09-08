# Callboard

Rehearsal tracks for a cast. A WordPress plugin that turns a site into a small, private music app: sets of audio, a player that keeps playing while you move around, lock-screen controls, offline saving, Web Push notices, and an "Add to Home Screen" flow on iPhone. The plugin renders the whole front end, whatever theme is active, and keeps the site out of search engines.

This file is the long-form record of the project: what it does, how it is built, which platform capabilities it leans on, and which ones were weighed and set aside. It is written so that someone arriving years from now can understand the decisions without reading the history.

## Try it

No install needed. Launch a scratch site from `main` with a demo set already imported.

[![Launch in WordPress Playground](https://img.shields.io/badge/Launch-3858E9?style=for-the-badge&logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/josephfusco/callboard/main/blueprint.json)

Every pull request gets its own Playground link in a sticky comment, built from that PR's commit. To run it locally with wp-env and the Playwright suite, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## What it does

- **The board.** The home page opens with what is posted: the next call pinned at the top with its time, place, and note, then anything else the stage manager has put up. A call is a post, written and scheduled like any post under Sets, and publishing one sends the push. The numbers being worked are taps that start the track.
- **Sets are posts.** A set is a `callboard_set` post. Its tracks are audio attachments parented to it, ordered and retitled in the set's edit screen. The featured image is the lock-screen cover.
- **Fetch from YouTube with WP-CLI** wherever `yt-dlp` exists: `wp callboard fetch '<url>' --name="Spring Show"`. Or queue URLs in the admin and let a machine with the tools drain the queue with `wp callboard run`.
- **Import a folder** of audio plus `manifest.json` from `wp-content/uploads/callboard/<slug>/`, for hosts that cannot run binaries.
- **Player.** One persistent deck: waveform scrubber, A/B loop, speed with the pitch held, count-in on tracks with a tempo, lyrics in time, timestamped director's notes, AirPlay and Cast, lock-screen controls, one tab playing at a time.
- **Offline.** Each set offers "Save offline". Saved audio plays from the service worker, seeks included, with no network.
- **Notices.** The cast opts in from the home page. You send messages from the Notices screen under Sets, and new sets announce themselves.
- **Settings**, under Sets: tagline, footer note, an emoji badge on the playing track, confetti text (and optional hearts) behind a triple tap on the title, the iPhone install hint, and switches for offline saving, notifications, new-set and new-call notices, and the count-in.

## How it is built

<details open>
<summary>Request flow</summary>

`Router` registers two routes, the home page and `/<set-slug>/`. Anything else falls back to home with a note. On `template_redirect`, `Frontend` renders the page from the templates in `templates/` and sends only the plugin's own stylesheet and script, so the active theme never shows through.

The script then takes over navigation. Moving between home and a set is a `pushState` plus a view transition, and the view that swaps in comes from the server too: the script fetches the same URL with `?fragment=1`, which renders the view template without the shell, and replaces `<main>`. There is one renderer, in PHP. The first touch on a link starts the fetch, so the view is usually there by the time the tap lands, and the home fragment is prefetched at idle from a set page. The player reads its data from `Sets::app_data()`, shipped once with the page and filterable as `callboard_app_data`; a set's data passes through `callboard_set_data`.

Everything that appears after script runs holds its place from the first paint: save marks, header buttons, and the speaker picker render in place and change state, never presence. There is no layout shift on load.

</details>

<details>
<summary>One script, one stylesheet, no build step</summary>

`assets/app.js` is a single IIFE and `assets/app.css` is a single file, both served as written. There is no bundler, no framework, no transpiler. The plugin has to keep working for years on a site nobody is maintaining, and a build chain is the part most likely to rot. Every capability the app uses is a browser API behind a feature check, and the CSS degrades through `@supports` and media queries. The service worker `pwa/sw.js` is templated by `Pwa::write_files()` into the site root, because a worker can only control the scope it is served from.

Design rules the code follows: transform and opacity animations only, no font-weight changes for state, native controls first, dark and light schemes from one set of tokens.

</details>

<details>
<summary>Data model</summary>

| Where | What |
| --- | --- |
| `callboard_call` post | A posted call: title and body from the editor, `_callboard_when` in the site's time zone (empty for a plain notice), `_callboard_where`, `_callboard_numbers` as the attachment ids of the tracks being worked. It leaves the board six hours after its time |
| `callboard_set` post | Name, slug, order, credits (`_callboard_credits`), source link, share image |
| Audio attachment, parented to the set | The track. `menu_order` is its position |
| `_callboard_duration` | Seconds, measured at import |
| `_callboard_levels` | Loudness envelope, a string of digits 0 to 9, ten per second. Drives the waveform and the filament, so iPhones, which cannot analyse audio live, see real levels |
| `_callboard_lyrics` and `_callboard_lyrics_approved` | Timed lines from captions, held until someone approves them in the admin |
| `_callboard_notes` | Director's notes: a time, a line, a date. Shown in the deck as the playhead passes |
| `_callboard_bpm` | Tempo, for the count-in and the tempo mark in the list |
| `_callboard_video_id`, `_callboard_source_url`, `_callboard_uploader` | Provenance |

`Sets` is the read model. It turns posts and meta into the data the front end renders, cached in a transient for a day and flushed whenever a set or track is saved.

</details>

<details>
<summary>Import pipeline</summary>

Two ways in, one format between them.

1. **Fetch.** `Fetcher` runs `yt-dlp` (and `ffmpeg` when present) against a YouTube URL or playlist. It writes a folder under `wp-content/uploads/callboard/<slug>/` holding the mp3s, a `manifest.json` describing the set and its tracks, and sidecar files keyed by video id: `levels.json`, `lyrics.json` from auto-captions, `notes.json`, `tempo.json`. Paths to the binaries are filterable with `callboard_ytdlp_path` and `callboard_ffmpeg_path`.
2. **Import.** `Importer` reads that folder and creates or refreshes the set. The folder is an import format only; once imported, the posts are the source of truth. A re-import refreshes order, credits, and lyrics but never overwrites a title someone edited in the admin.

Managed hosts that cannot run binaries take the folder route: build it on a laptop with the same WP-CLI command, upload it, then import from the admin or with `wp callboard import`. `Requests` is the admin queue of URLs; `wp callboard run` drains it wherever the tools exist.

</details>

<details>
<summary>Offline</summary>

The service worker precaches the app shell, the home fragment included. When a set is saved, the page fetches that set's fragment once so the worker holds a copy, and does so again on the home screen for every saved set after an update, since the shell cache is versioned. A saved set therefore opens offline from a cold start: home from the shell, the set from its fragment. Saving a set streams each track into the Cache API while a `tee()` branch counts bytes for the progress ring, after asking for persistent storage and checking there is room. Playback of a saved track goes through the worker, which answers `Range` requests from the cached body so seeking works without a network. Saved audio lives in the Cache API rather than IndexedDB or OPFS because a whole file served with Range support is exactly what a media element needs, and it survives on iPhone.

</details>

<details>
<summary>Push</summary>

`Push` stores subscriptions through a REST route and sends with [web-push-php](https://github.com/web-push-libs/web-push-php). Payloads are declarative Web Push, so Safari shows them without waking the worker; everywhere else the worker's `push` handler shows the same notification. A `pushsubscriptionchange` handler re-subscribes when a browser rotates an endpoint and tells the site, so notices keep arriving with nobody tapping anything. VAPID keys are generated with OpenSSL and kept in an option.

</details>

<details>
<summary>Privacy</summary>

A cast site should not be discoverable. `Privacy` sends `noindex` through `wp_robots` and an `X-Robots-Tag` header, writes a closed `robots.txt`, sets a no-referrer policy, requires authentication for the REST API, hides the users endpoint, turns off XML-RPC and feed links, and sends author archives, feeds, and search back home. The plugin's own push routes are the one anonymous exception, and they accept only a subscription.

</details>

<details>
<summary>Artwork</summary>

`Art` draws covers, share cards, and the iPhone splash screens with GD: a warm ground, the set name, a label, one accent. Nothing is uploaded; everything is derived from the set.

</details>

<details>
<summary>Repository map</summary>

| Path | Purpose |
| --- | --- |
| `callboard.php` | Plugin header, constants, autoload, bootstrap |
| `includes/` | One class per concern, `Callboard\` namespace: `Plugin` wires them, `Router`, `Frontend`, `Sets`, `Calls`, `PostTypes`, `Admin`, `Settings`, `Importer`, `Fetcher`, `Requests`, `Push`, `Pwa`, `Privacy`, `Art`, `Cli`. `helpers.php` holds icons and formatting |
| `templates/` | Server-rendered views: `index.php` shell, `fragment.php` (a view without the shell, for navigation), `home.php`, `board.php` (the posted calls), `set.php`, `deck.php` (the player), `footer.php` |
| `assets/` | `app.js` and `app.css`, served as written |
| `pwa/sw.js` | Service worker source, templated into the site root |
| `tests/e2e/` | Playwright suites: front end, controls, PWA, admin, privacy, accessibility |
| `tests/fixtures/` | Demo sets and the `chiptunes.js` generator that renders them |
| `blueprint.json` | The WordPress Playground demo |
| `site/` | The GitHub Pages landing page |
| `scripts/sync-versions.sh` | Writes the release version everywhere WordPress reads it |
| `.github/` | Workflows, Dependabot, the PR template, CONTRIBUTING |

</details>

## WP-CLI

| Command | Does |
| --- | --- |
| `wp callboard fetch <url> --name=<name> [--slug=<slug>]` | Build a set folder from a YouTube video or playlist and import it |
| `wp callboard run [--interval=<seconds>]` | Drain the admin's fetch queue, once or on a loop |
| `wp callboard import` | Import every folder under `uploads/callboard/` |
| `wp callboard levels <slug>` | Measure loudness envelopes for a set imported without them |
| `wp callboard notify <message> [--title=<title>] [--url=<url>]` | Send a notice to every subscriber |
| `wp callboard doctor` | Report which tools and PHP extensions are available |

## APIs it uses

Everything below is in use today. Web platform links go to the specification, WordPress links to the developer handbook, PHP links to the manual. The watchlist that follows tracks what is next.

<details open>
<summary>Web platform</summary>

- [x] [Service Workers](https://w3c.github.io/ServiceWorker/) for the app shell, offline audio, and push handling in `pwa/sw.js`, with navigation preload
- [x] [Cache API](https://w3c.github.io/ServiceWorker/#cache-interface) for the shell and user-saved tracks
- [x] [Fetch](https://fetch.spec.whatwg.org/) and [HTTP range requests](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests), so cached audio still seeks
- [x] [Web App Manifest](https://www.w3.org/TR/appmanifest/), written to the site root by the plugin
- [x] [Push API](https://www.w3.org/TR/push-api/) and [Notifications API](https://notifications.spec.whatwg.org/) for notices, with declarative payloads and a `pushsubscriptionchange` handler that re-registers a rotated endpoint
- [x] [Media Session API](https://www.w3.org/TR/mediasession/) for lock-screen artwork and controls
- [x] [HTML media element](https://html.spec.whatwg.org/multipage/media.html) as the player itself, with [preservesPitch](https://html.spec.whatwg.org/multipage/media.html#dom-media-preservespitch) behind the speed control
- [x] [Remote Playback API](https://www.w3.org/TR/remote-playback/) for AirPlay and Cast from the deck; the picker holds a slot and appears when a device is available
- [x] [Web Share](https://www.w3.org/TR/web-share/) to hand a set link to the system sheet, with the [Clipboard API](https://www.w3.org/TR/clipboard-apis/) as the fallback
- [x] [Vibration API](https://www.w3.org/TR/vibration/) for haptics where it exists
- [x] [Web Audio API](https://www.w3.org/TR/webaudio/) for the level meter, the count-in click, and a sample-accurate A/B loop while the page is in front
- [x] [Audio Session API](https://w3c.github.io/audio-session/) to declare playback so iOS treats it like a music app
- [x] [Screen Wake Lock API](https://www.w3.org/TR/screen-wake-lock/) while a loop runs or the lyrics are open
- [x] [Badging API](https://www.w3.org/TR/badging/) to set the icon badge from a notice and clear it on open
- [x] [Storage API](https://storage.spec.whatwg.org/) to ask for persistent storage before saving audio, and to check there is room before a save starts
- [x] [Streams API](https://streams.spec.whatwg.org/) to save a track into the cache while a `tee()` branch counts bytes for the progress ring
- [x] [Canvas 2D](https://html.spec.whatwg.org/multipage/canvas.html) to draw the waveform from the levels the import measured, with a hover preview of where a click would land
- [x] [TextTrack API](https://html.spec.whatwg.org/multipage/media.html#text-track-api) for the lyric cues, so `cuechange` keeps them in time when the tab is throttled
- [x] [Web Locks](https://www.w3.org/TR/web-locks/) so only one tab plays at a time
- [x] [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html) for small player state such as the remembered speed
- [x] [History API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-history-interface) for in-app navigation
- [x] [Online and offline events](https://html.spec.whatwg.org/multipage/system-state.html#navigator.online) for the offline banner
- [x] [Pointer Events](https://www.w3.org/TR/pointerevents/) for the scrubber, edge-swipe back, and taps
- [x] [ResizeObserver](https://www.w3.org/TR/resize-observer/) to measure the deck and publish its height as a token, so Dynamic Type and landscape insets never hide the last track
- [x] [Back/forward cache](https://web.dev/articles/bfcache) restores through `pageshow`, re-reading the media element instead of trusting the last frame drawn
- [x] [View Transitions](https://www.w3.org/TR/css-view-transitions-1/) between the home page and a set
- [x] [requestIdleCallback](https://www.w3.org/TR/requestidlecallback/) for deferred setup
- [x] [AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller) to cancel an offline save in flight
- [x] [display-mode media feature](https://www.w3.org/TR/mediaqueries-5/#display-mode) to detect the installed app
- [x] [beforeinstallprompt](https://wicg.github.io/manifest-incubations/#installation-prompts) where browsers offer it
- [x] [Apple web app meta tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) and the [WebKit switch control](https://webkit.org/blog/15054/an-html-switch-control/), the only route to haptics on iPhone (iOS 18 or later)

</details>

<details>
<summary>CSS</summary>

- [x] [Environment variables](https://www.w3.org/TR/css-env-1/) for the safe-area insets on all four sides, with `max()` so the column clears the island in landscape
- [x] [text-box-trim](https://www.w3.org/TR/css-inline-3/#text-box-trim) on headings behind `@supports`, so the space above a title is measured from the cap height (Safari 18.2, Chrome 133)
- [x] Dynamic Type through `font: -apple-system-body`, so the app follows the iPhone's text size setting
- [x] [backdrop-filter](https://www.w3.org/TR/filter-effects-2/#BackdropFilterProperty) on the deck and top bar, with an `@supports` fallback to a solid ground
- [x] [@starting-style](https://www.w3.org/TR/css-transitions-2/#defining-before-change-style) for enter animations
- [x] [Scroll-driven animations](https://www.w3.org/TR/scroll-animations-1/) behind `@supports`
- [x] [User preference media features](https://www.w3.org/TR/mediaqueries-5/#mf-user-preferences): color scheme, reduced motion, reduced transparency, contrast, forced colors
- [x] [Container queries](https://www.w3.org/TR/css-contain-3/) so the deck's time row drops the total when the column is too narrow for both times
- [x] [Anchor positioning](https://www.w3.org/TR/css-anchor-position-1/) to sit the install card and update toast on the deck's top edge, with a height token as the fallback
- [x] [color-mix()](https://www.w3.org/TR/css-color-5/#color-mix) for the waveform glow and the quiet capsules, [clip-path](https://www.w3.org/TR/css-masking-1/#the-clip-path) and [mask-image](https://www.w3.org/TR/css-masking-1/#the-mask-image) for the played part of the wave
- [x] [:has()](https://www.w3.org/TR/selectors-4/#relational), [touch-action](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property), [overscroll-behavior](https://www.w3.org/TR/css-overscroll-1/), [text-wrap](https://www.w3.org/TR/css-text-4/#text-wrap) including `pretty` on lyric lines and titles

</details>

<details>
<summary>WordPress</summary>

- [x] [REST API](https://developer.wordpress.org/rest-api/) for push subscriptions, the only anonymous routes on the site
- [x] [WP-CLI commands](https://make.wordpress.org/cli/handbook/guides/commands-cookbook/) for `wp callboard fetch`, `run`, `import`, `levels`, `notify`, and `doctor`
- [x] [Custom post types](https://developer.wordpress.org/plugins/post-types/) for sets, with tracks as [attachments](https://developer.wordpress.org/reference/functions/wp_insert_attachment/)
- [x] [Meta boxes](https://developer.wordpress.org/plugins/metadata/custom-meta-boxes/) and [post meta](https://developer.wordpress.org/plugins/metadata/managing-post-metadata/) for credits, order, lyrics, notes, and tempo
- [x] [Settings API](https://developer.wordpress.org/plugins/settings/settings-api/) and [Options API](https://developer.wordpress.org/apis/options/) for the tagline, badge, and switches
- [x] [Transients API](https://developer.wordpress.org/apis/transients/) for the rendered set data
- [x] [Filesystem API](https://developer.wordpress.org/apis/filesystem/) to write the manifest and service worker
- [x] [Nonces](https://developer.wordpress.org/apis/security/nonces/) and [admin-post actions](https://developer.wordpress.org/reference/hooks/admin_post_action/) for admin forms
- [x] [template_redirect](https://developer.wordpress.org/reference/hooks/template_redirect/) to render the whole front end regardless of theme
- [x] [wp_robots](https://developer.wordpress.org/reference/functions/wp_robots/) plus an `X-Robots-Tag` header to keep the site out of search engines
- [x] [Plugin header](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/) and [readme.txt](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/) conventions, checked by Plugin Check

</details>

<details>
<summary>PHP and server side</summary>

- [x] [GD image functions](https://www.php.net/manual/en/book.image.php) to draw covers, share cards, and iPhone splash screens
- [x] [proc_open](https://www.php.net/manual/en/function.proc_open.php) to run the fetch tools from WP-CLI
- [x] [OpenSSL](https://www.php.net/manual/en/book.openssl.php) with [GMP](https://www.php.net/manual/en/book.gmp.php) or [BCMath](https://www.php.net/manual/en/book.bc.php) for push key generation
- [x] [web-push-php](https://github.com/web-push-libs/web-push-php) implementing [Web Push](https://www.rfc-editor.org/rfc/rfc8030), [VAPID](https://www.rfc-editor.org/rfc/rfc8292), and [message encryption](https://www.rfc-editor.org/rfc/rfc8291)

</details>

<details>
<summary>Tools it shells out to</summary>

- [x] [yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options) to fetch audio and captions
- [x] [ffmpeg](https://ffmpeg.org/ffmpeg.html) to transcode to mp3, measure duration, and measure levels
- [x] [WordPress Playground blueprints](https://wordpress.github.io/wordpress-playground/blueprints/) for the demo links

</details>

## Web platform watchlist

A running log of browser and WordPress capabilities and what each would do for a rehearsal app. Adopted items move up to the list above; the rest sit here with a verdict, so the next person does not have to re-evaluate them. Check a box when it ships.

<details>
<summary>Ready to adopt</summary>

- [ ] A gated front end with [WebAuthn passkeys](https://www.w3.org/TR/webauthn-3/). The site is visible to anyone with the URL today; a cast app should not be. Passkeys stored in iCloud Keychain or Google Password Manager give a one-tap, Face ID sign-in with no third party, on every platform, in the self-hosted spirit. Pair with invite links from the director. Considered and set aside: OAuth through GitHub or Apple (a third party in the loop, and Sign in with Apple needs a developer account), and the Presence API (it answers who is here, not who may enter).
- [ ] [WebRTC data channels](https://www.w3.org/TR/webrtc/) for a director's live cue to every phone in the room ("from the top of 14"), with a WordPress route only for signaling. Presence-style, but native to the PWA.
- [ ] [AudioWorklet](https://www.w3.org/TR/webaudio/#AudioWorklet) for transposing a track without changing tempo. The one feature choir directors ask for most, and the largest item here: a worklet plus a pitch-shift kernel.
- [ ] [Media Capabilities](https://www.w3.org/TR/media-capabilities/) so the client picks the format it decodes best when the importer kept m4a as well as mp3.
- [ ] [Navigation API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api) to replace the hand-rolled `pushState` routing and integrate with view transitions directly. Safari 18.4 and later.
- [ ] CSS [`light-dark()`](https://www.w3.org/TR/css-color-5/#light-dark) to collapse the two token blocks into one (Safari 17.5, Chrome 123), [scroll snap](https://www.w3.org/TR/css-scroll-snap-1/) for swiping between sets, [`contrast-color()`](https://www.w3.org/TR/css-color-5/#contrast-color) for the text on the accent (Safari 26).

</details>

<details>
<summary>Waiting on browsers</summary>

- [ ] [Background Fetch](https://wicg.github.io/background-fetch/) to save a set while the app is closed. Chromium only; on iPhone a save stops when the user leaves, which the partial-save state already handles.
- [ ] [Web Share Target](https://w3c.github.io/web-share-target/) to receive a YouTube link into the import queue from the system share sheet. Android and desktop Chromium only.
- [ ] [Periodic Background Sync](https://wicg.github.io/periodic-background-sync/) to refresh sets overnight. Chromium only.
- [ ] [Storage Buckets](https://wicg.github.io/storage-buckets/) to give saved audio its own eviction policy. Chromium only.
- [ ] [Manifest `shortcuts`](https://www.w3.org/TR/appmanifest/#shortcuts-member) are written; iOS ignores them.
- [ ] [Remote Playback availability for audio](https://www.w3.org/TR/remote-playback/#dom-htmlmediaelement-remote) in Safari. Where `watchAvailability` is not implemented the picker is shown regardless.
- [ ] [Invoker commands](https://open-ui.org/components/invokers.explainer/) (`command`, `commandfor`) to wire the sheet and controls without script. Chrome 135 and later, Safari 26.
- [ ] [Anchor positioning](https://www.w3.org/TR/css-anchor-position-1/) is in use behind `@supports`; the height-token fallback goes when Safari 26 is the floor.

</details>

<details>
<summary>WordPress</summary>

- [ ] [Interactivity API](https://developer.wordpress.org/block-editor/reference-guides/interactivity-api/) if the admin screens ever grow beyond forms; the front end is a single script by design and does not need it.
- [ ] [Script Modules](https://make.wordpress.org/core/2024/03/04/script-modules-in-6-5/) to load the app as an ES module with import maps once the service worker precache learns module URLs.
- [ ] [HTML API](https://developer.wordpress.org/reference/classes/wp_html_tag_processor/) to rewrite the rendered shell instead of regular expressions, should the theme ever be allowed to contribute markup.
- [ ] [Abilities API](https://make.wordpress.org/core/tag/abilities-api/) to expose import and notice sending to agents and other plugins.
- [ ] [Presence API](https://github.com/WordPress/presence-api) (a Featured Plugin) for the sign-in sheet: who is in the building at half hour. On the front end it needs every cast member known to the site, which waits on the gated front end above; the honor-system version (pick your name once, the device remembers) can come first.
- [ ] [Plugin dependencies header](https://make.wordpress.org/core/2024/03/05/introducing-plugin-dependencies-in-wordpress-6-5/) is not needed; the plugin stands alone.

</details>

<details>
<summary>Ruled out, and why</summary>

- [x] [Popover API](https://html.spec.whatwg.org/multipage/popover.html) for the lyrics sheet. Its top layer would sit over the deck, and the sheet is meant to stop at the deck so the transport stays reachable.
- [x] [Vibration API](https://www.w3.org/TR/vibration/) on iPhone. Not implemented there; the WebKit switch control is the only haptic route, and it is used.
- [x] Client-side waveform libraries (wavesurfer.js, peaks.js). Both decode audio in the browser, which iPhone Safari cannot do for long files and which would break offline playback. The importer already measures levels ten times a second, so the deck draws from those.
- [x] [IndexedDB](https://www.w3.org/TR/IndexedDB/) or [OPFS](https://fs.spec.whatwg.org/) for saved audio. The Cache API serves whole files with Range support from the service worker, which is what playback needs.
- [x] [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) and [Web MIDI](https://www.w3.org/TR/webmidi/) for foot pedals. Chromium only, and a Bluetooth pedal already arrives as keyboard media keys, which the Media Session handlers catch.
- [x] The [Declarative Web Push `app_badge`](https://www.w3.org/TR/push-api/#declarative-push-message) field as a live count. The payload carries it and the worker honors it, but the count is always 1; an unread count would need server-side state per subscriber, which a rehearsal notice does not justify.

</details>

## Tests

The Playwright suite in `tests/e2e/` runs against wp-env before every commit, from a pre-commit hook `npm install` wires up. It does not run in GitHub Actions: the repository is private and the suite needs a full WordPress. Headless Chromium cannot decode mp3, so the control tests count transport calls and assert on state rather than on audio. One test fetches the fragment endpoint directly and then watches a navigation swap it in, which is what keeps the single renderer honest.

The fixtures are ten public-domain melodies rendered by `tests/fixtures/chiptunes.js` in the manner of an eighties home keyboard with presets, so the demo has real music with no rights to clear. Their covers are drawn by the plugin's own `Art` class, the way a fetched set's would be. Run the generator with `node tests/fixtures/chiptunes.js` (needs ffmpeg and ffprobe) to rebuild the mp3s, manifests, and sidecars; the Playground blueprint embeds the same files.

## Releases

Pull request titles are [Conventional Commits](https://www.conventionalcommits.org/), and [release-please](https://github.com/googleapis/release-please) turns them into the version, the changelog, and a GitHub Release with `callboard.zip` attached. Install that zip like any other plugin. The rest of the maintenance is automated and described in [CONTRIBUTING.md](.github/CONTRIBUTING.md).

GPL-2.0-or-later.
