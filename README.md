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

## APIs it uses

Everything below is in use today. Web platform links go to the specification, WordPress links to the developer handbook, PHP links to the manual. The watchlist that follows tracks what is next.

<details open>
<summary>Web platform</summary>

- [x] [Service Workers](https://w3c.github.io/ServiceWorker/) for the app shell, offline audio, and push handling in `pwa/sw.js`
- [x] [Cache API](https://w3c.github.io/ServiceWorker/#cache-interface) for the shell and user-saved tracks
- [x] [Fetch](https://fetch.spec.whatwg.org/) and [HTTP range requests](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests), so cached audio still seeks
- [x] [Web App Manifest](https://www.w3.org/TR/appmanifest/), written to the site root by the plugin
- [x] [Push API](https://www.w3.org/TR/push-api/) and [Notifications API](https://notifications.spec.whatwg.org/) for notices, with declarative payloads and a `pushsubscriptionchange` handler that re-registers a rotated endpoint
- [x] [Media Session API](https://www.w3.org/TR/mediasession/) for lock-screen artwork and controls
- [x] [HTML media element](https://html.spec.whatwg.org/multipage/media.html) as the player itself, with [preservesPitch](https://html.spec.whatwg.org/multipage/media.html#dom-media-preservespitch) behind the speed chip
- [x] [Remote Playback API](https://www.w3.org/TR/remote-playback/) for AirPlay and Cast from the deck
- [x] [Web Share](https://www.w3.org/TR/web-share/) to hand a set link to the system sheet, with the [Clipboard API](https://www.w3.org/TR/clipboard-apis/) as the fallback
- [x] [Vibration API](https://www.w3.org/TR/vibration/) for haptics where it exists
- [x] [Web Audio API](https://www.w3.org/TR/webaudio/) for the level meter, the count-in click, and a sample-accurate A/B loop while the page is in front
- [x] [Audio Session API](https://w3c.github.io/audio-session/) to declare playback so iOS treats it like a music app
- [x] [Screen Wake Lock API](https://www.w3.org/TR/screen-wake-lock/) while a set plays
- [x] [Badging API](https://www.w3.org/TR/badging/) to clear the icon badge on open
- [x] [Storage API](https://storage.spec.whatwg.org/) to ask for persistent storage before saving audio, and to check there is room before a save starts
- [x] [Streams API](https://streams.spec.whatwg.org/) to save a track into the cache while a `tee()` branch counts bytes for the progress ring
- [x] [Canvas 2D](https://html.spec.whatwg.org/multipage/canvas.html) to draw the waveform from the levels the import measured
- [x] [TextTrack API](https://html.spec.whatwg.org/multipage/media.html#text-track-api) for the lyric cues, so `cuechange` keeps them in time when the tab is throttled
- [x] [Web Locks](https://www.w3.org/TR/web-locks/) so only one tab plays at a time
- [x] [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html) for small player state
- [x] [History API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-history-interface) for in-app navigation
- [x] [Online and offline events](https://html.spec.whatwg.org/multipage/system-state.html#navigator.online) for the offline banner
- [x] [Pointer Events](https://www.w3.org/TR/pointerevents/) for the scrubber, edge-swipe back, and taps
- [x] [View Transitions](https://www.w3.org/TR/css-view-transitions-1/) between the home page and a set
- [x] [requestIdleCallback](https://www.w3.org/TR/requestidlecallback/) for deferred setup
- [x] [AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller) to cancel in-flight fetches
- [x] [display-mode media feature](https://www.w3.org/TR/mediaqueries-5/#display-mode) to detect the installed app
- [x] [beforeinstallprompt](https://wicg.github.io/manifest-incubations/#installation-prompts) where browsers offer it
- [x] [Apple web app meta tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) and the [WebKit switch control](https://webkit.org/blog/15054/an-html-switch-control/), the only route to haptics on iPhone (iOS 18 or later)

</details>

<details>
<summary>CSS</summary>

- [x] [Environment variables](https://www.w3.org/TR/css-env-1/) for the safe-area insets
- [x] [backdrop-filter](https://www.w3.org/TR/filter-effects-2/#BackdropFilterProperty) with an `@supports` fallback
- [x] [@starting-style](https://www.w3.org/TR/css-transitions-2/#defining-before-change-style) for enter animations
- [x] [Scroll-driven animations](https://www.w3.org/TR/scroll-animations-1/) behind `@supports`
- [x] [User preference media features](https://www.w3.org/TR/mediaqueries-5/#mf-user-preferences): color scheme, reduced motion, reduced transparency, contrast
- [x] [Container queries](https://www.w3.org/TR/css-contain-3/) so the deck's time row drops the total when its chips would not fit
- [x] [Anchor positioning](https://www.w3.org/TR/css-anchor-position-1/) to sit the install card and update toast on the deck's top edge, with a height token as the fallback
- [x] [color-mix()](https://www.w3.org/TR/css-color-5/#color-mix) for the waveform glow, [clip-path](https://www.w3.org/TR/css-masking-1/#the-clip-path) for its played half
- [x] [:has()](https://www.w3.org/TR/selectors-4/#relational), [touch-action](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property), [overscroll-behavior](https://www.w3.org/TR/css-overscroll-1/), [text-wrap](https://www.w3.org/TR/css-text-4/#text-wrap) including `pretty` on lyric lines and titles

</details>

<details>
<summary>WordPress</summary>

- [x] [REST API](https://developer.wordpress.org/rest-api/) for push subscriptions
- [x] [WP-CLI commands](https://make.wordpress.org/cli/handbook/guides/commands-cookbook/) for `wp callboard fetch`, `run`, `import`, and `doctor`
- [x] [Custom post types](https://developer.wordpress.org/plugins/post-types/) for sets, with tracks as [attachments](https://developer.wordpress.org/reference/functions/wp_insert_attachment/)
- [x] [Meta boxes](https://developer.wordpress.org/plugins/metadata/custom-meta-boxes/) and [post meta](https://developer.wordpress.org/plugins/metadata/managing-post-metadata/) for credits, order, and cues
- [x] [Settings API](https://developer.wordpress.org/plugins/settings/settings-api/) and [Options API](https://developer.wordpress.org/apis/options/) for the tagline, badge, and toggles
- [x] [Transients API](https://developer.wordpress.org/apis/transients/) for short-lived caches
- [x] [Filesystem API](https://developer.wordpress.org/apis/filesystem/) to write the manifest and service worker
- [x] [Nonces](https://developer.wordpress.org/apis/security/nonces/) and [admin-post actions](https://developer.wordpress.org/reference/hooks/admin_post_action/) for admin forms
- [x] [template_redirect](https://developer.wordpress.org/reference/hooks/template_redirect/) to render the whole front end regardless of theme
- [x] [wp_robots](https://developer.wordpress.org/reference/functions/wp_robots/) plus an `X-Robots-Tag` header to keep the site out of search engines
- [x] [Plugin header](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/) and [readme.txt](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/) conventions, checked by Plugin Check in CI

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
- [x] [ffmpeg](https://ffmpeg.org/ffmpeg.html) to transcode to mp3 and measure levels
- [x] [WordPress Playground blueprints](https://wordpress.github.io/wordpress-playground/blueprints/) for the demo links

</details>

## Web platform watchlist

A running log of browser and WordPress capabilities and what each would do for a rehearsal app. Adopted items move up to the list above; the rest sit here with a verdict, so the next person does not have to re-evaluate them. Check a box when it ships.

<details>
<summary>Ready to adopt</summary>

- [ ] A gated front end with [WebAuthn passkeys](https://www.w3.org/TR/webauthn-3/). The site is visible to anyone with the URL today; a cast app should not be. Passkeys stored in iCloud Keychain or Google Password Manager give a one-tap, Face ID sign-in with no third party, on every platform, in the self-hosted spirit. Pair with invite links from the director.
- [ ] [AudioWorklet](https://www.w3.org/TR/webaudio/#AudioWorklet) for transposing a track without changing tempo. The one feature choir directors ask for most, and the largest item here: a worklet plus a pitch-shift kernel.
- [ ] [Media Capabilities](https://www.w3.org/TR/media-capabilities/) so the client picks the format it decodes best when the importer kept m4a as well as mp3.
- [ ] [Navigation API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api) to replace the hand-rolled `pushState` routing and integrate with view transitions directly. Safari 18.4 and later.
- [ ] [Declarative Web Push `app_badge`](https://www.w3.org/TR/push-api/#declarative-push-message) so a notice sets the icon badge without the worker waking. The payload already carries the field; the count is always 1.
- [ ] CSS [`light-dark()`](https://www.w3.org/TR/css-color-5/#light-dark) for the color tokens, [`text-box-trim`](https://www.w3.org/TR/css-inline-3/#text-box-trim) to make the vertical rhythm exact, [scroll snap](https://www.w3.org/TR/css-scroll-snap-1/) for swiping between sets.

</details>

<details>
<summary>Waiting on browsers</summary>

- [ ] [Background Fetch](https://wicg.github.io/background-fetch/) to save a set while the app is closed. Chromium only; on iPhone a save stops when the user leaves, which the partial-save state already handles.
- [ ] [Web Share Target](https://w3c.github.io/web-share-target/) to receive a YouTube link into the import queue from the system share sheet. Android and desktop Chromium only.
- [ ] [Periodic Background Sync](https://wicg.github.io/periodic-background-sync/) to refresh sets overnight. Chromium only.
- [ ] [Storage Buckets](https://wicg.github.io/storage-buckets/) to give saved audio its own eviction policy. Chromium only.
- [ ] [Manifest `shortcuts`](https://www.w3.org/TR/appmanifest/#shortcuts-member) are written; iOS ignores them.
- [ ] [Remote Playback availability for audio](https://www.w3.org/TR/remote-playback/#dom-htmlmediaelement-remote) in Safari. Until it arrives the AirPlay chip is always shown there.
- [ ] [Invoker commands](https://open-ui.org/components/invokers.explainer/) (`command`, `commandfor`) to wire the sheet and chips without script. Chrome 135 and later, Safari 26.
- [ ] [Anchor positioning](https://www.w3.org/TR/css-anchor-position-1/) is in use behind `@supports`; the height-token fallback goes when Safari 26 is the floor.

</details>

<details>
<summary>WordPress</summary>

- [ ] [Interactivity API](https://developer.wordpress.org/block-editor/reference-guides/interactivity-api/) if the admin screens ever grow beyond forms; the front end is a single script by design and does not need it.
- [ ] [Script Modules](https://make.wordpress.org/core/2024/03/04/script-modules-in-6-5/) to load the app as an ES module with import maps once the service worker precache learns module URLs.
- [ ] [HTML API](https://developer.wordpress.org/reference/classes/wp_html_tag_processor/) to rewrite the rendered shell instead of regular expressions, should the theme ever be allowed to contribute markup.
- [ ] [Abilities API](https://make.wordpress.org/core/tag/abilities-api/) to expose import and notice sending to agents and other plugins.
- [ ] [Plugin dependencies header](https://make.wordpress.org/core/2024/03/05/introducing-plugin-dependencies-in-wordpress-6-5/) is not needed; the plugin stands alone.

</details>

<details>
<summary>Ruled out, and why</summary>

- [x] [Popover API](https://html.spec.whatwg.org/multipage/popover.html) for the lyrics sheet. Its top layer would sit over the deck, and the sheet is meant to stop at the deck so the transport stays reachable.
- [x] [Vibration API](https://www.w3.org/TR/vibration/) on iPhone. Not implemented there; the WebKit switch control is the only haptic route, and it is used.
- [x] Client-side waveform libraries (wavesurfer.js, peaks.js). Both decode audio in the browser, which iPhone Safari cannot do for long files and which would break offline playback. The importer already measures levels ten times a second, so the deck draws from those.
- [x] [IndexedDB](https://www.w3.org/TR/IndexedDB/) or [OPFS](https://fs.spec.whatwg.org/) for saved audio. The Cache API serves whole files with Range support from the service worker, which is what playback needs.
- [x] [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) and [Web MIDI](https://www.w3.org/TR/webmidi/) for foot pedals. Chromium only, and a Bluetooth pedal already arrives as keyboard media keys, which the Media Session handlers catch.

</details>

## Releases

Pull request titles are [Conventional Commits](https://www.conventionalcommits.org/), and [release-please](https://github.com/googleapis/release-please) turns them into the version, the changelog, and a GitHub Release with `callboard.zip` attached. Install that zip like any other plugin.

GPL-2.0-or-later.
