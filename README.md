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

Everything below is in use today. Web platform links go to the specification, WordPress links to the developer handbook, PHP links to the manual.

### Web platform

- [x] [Service Workers](https://w3c.github.io/ServiceWorker/) for the app shell, offline audio, and push handling in `pwa/sw.js`
- [x] [Cache API](https://w3c.github.io/ServiceWorker/#cache-interface) for the shell and user-saved tracks
- [x] [Fetch](https://fetch.spec.whatwg.org/) and [HTTP range requests](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests), so cached audio still seeks
- [x] [Web App Manifest](https://www.w3.org/TR/appmanifest/), written to the site root by the plugin
- [x] [Push API](https://www.w3.org/TR/push-api/) and [Notifications API](https://notifications.spec.whatwg.org/) for notices
- [x] [Media Session API](https://www.w3.org/TR/mediasession/) for lock-screen artwork and controls
- [x] [HTML media element](https://html.spec.whatwg.org/multipage/media.html) as the player itself, with [preservesPitch](https://html.spec.whatwg.org/multipage/media.html#dom-media-preservespitch) behind the speed chip
- [x] [Remote Playback API](https://www.w3.org/TR/remote-playback/) for AirPlay and Cast from the deck
- [x] [Web Share](https://www.w3.org/TR/web-share/) to hand a set link to the system sheet, with the [Clipboard API](https://www.w3.org/TR/clipboard-apis/) as the fallback
- [x] [Vibration API](https://www.w3.org/TR/vibration/) for haptics where it exists
- [x] [Web Audio API](https://www.w3.org/TR/webaudio/) for the level meter
- [x] [Audio Session API](https://w3c.github.io/audio-session/) to declare playback so iOS treats it like a music app
- [x] [Screen Wake Lock API](https://www.w3.org/TR/screen-wake-lock/) while a set plays
- [x] [Badging API](https://www.w3.org/TR/badging/) to clear the icon badge on open
- [x] [Storage API](https://storage.spec.whatwg.org/) to ask for persistent storage before saving audio
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

### CSS

- [x] [Environment variables](https://www.w3.org/TR/css-env-1/) for the safe-area insets
- [x] [backdrop-filter](https://www.w3.org/TR/filter-effects-2/#BackdropFilterProperty) with an `@supports` fallback
- [x] [@starting-style](https://www.w3.org/TR/css-transitions-2/#defining-before-change-style) for enter animations
- [x] [Scroll-driven animations](https://www.w3.org/TR/scroll-animations-1/) behind `@supports`
- [x] [User preference media features](https://www.w3.org/TR/mediaqueries-5/#mf-user-preferences): color scheme, reduced motion, reduced transparency, contrast
- [x] [:has()](https://www.w3.org/TR/selectors-4/#relational), [touch-action](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property), [overscroll-behavior](https://www.w3.org/TR/css-overscroll-1/), [text-wrap](https://www.w3.org/TR/css-text-4/#text-wrap)

### WordPress

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

### PHP and server side

- [x] [GD image functions](https://www.php.net/manual/en/book.image.php) to draw covers, share cards, and iPhone splash screens
- [x] [proc_open](https://www.php.net/manual/en/function.proc_open.php) to run the fetch tools from WP-CLI
- [x] [OpenSSL](https://www.php.net/manual/en/book.openssl.php) with [GMP](https://www.php.net/manual/en/book.gmp.php) or [BCMath](https://www.php.net/manual/en/book.bc.php) for push key generation
- [x] [web-push-php](https://github.com/web-push-libs/web-push-php) implementing [Web Push](https://www.rfc-editor.org/rfc/rfc8030), [VAPID](https://www.rfc-editor.org/rfc/rfc8292), and [message encryption](https://www.rfc-editor.org/rfc/rfc8291)

### Tools it shells out to

- [x] [yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options) to fetch audio and captions
- [x] [ffmpeg](https://ffmpeg.org/ffmpeg.html) to transcode to mp3 and measure levels
- [x] [WordPress Playground blueprints](https://wordpress.github.io/wordpress-playground/blueprints/) for the demo links

## Releases

Pull request titles are [Conventional Commits](https://www.conventionalcommits.org/), and [release-please](https://github.com/googleapis/release-please) turns them into the version, the changelog, and a GitHub Release with `callboard.zip` attached. Install that zip like any other plugin.

GPL-2.0-or-later.
