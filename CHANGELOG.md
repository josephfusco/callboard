# Changelog

## [1.5.0](https://github.com/josephfusco/callboard/compare/v1.4.2...v1.5.0) (2026-09-07)


### Features

* a deeper deck, with the controls drawn as things you can press ([#21](https://github.com/josephfusco/callboard/issues/21)) ([604dc52](https://github.com/josephfusco/callboard/commit/604dc52a1fab2512d3555dec8fe90d4d30ec91bc))
* a gapless A/B loop while the page is in front ([#25](https://github.com/josephfusco/callboard/issues/25)) ([d552105](https://github.com/josephfusco/callboard/commit/d552105bc3efa0a517b442f9ca6053d4ed821a12))
* lyric cues as a text track, one player per site, push subscriptions that survive rotation ([#23](https://github.com/josephfusco/callboard/issues/23)) ([2e29e6c](https://github.com/josephfusco/callboard/commit/2e29e6c03973f8ff49f0149f33de31b1454b77bc))
* waveform in the deck, and a deck that keeps one height ([#18](https://github.com/josephfusco/callboard/issues/18)) ([1f85655](https://github.com/josephfusco/callboard/commit/1f8565538f367e91f2e663f634d72b278a98e19a))


### Bug Fixes

* the deck row never collides with the controls, and saving knows about space ([#17](https://github.com/josephfusco/callboard/issues/17)) ([ccb3e89](https://github.com/josephfusco/callboard/commit/ccb3e89582aa6b0bcbfa6ba2dd9d5b3584b918b9))

## [1.4.2](https://github.com/josephfusco/callboard/compare/v1.4.1...v1.4.2) (2026-09-07)


### Bug Fixes

* polish the set header, deck time row, and stylesheet ([#15](https://github.com/josephfusco/callboard/issues/15)) ([a750016](https://github.com/josephfusco/callboard/commit/a750016d2d66dc4a900e57120d7ae19ef9cd8215))

## [1.4.1](https://github.com/josephfusco/callboard/compare/v1.4.0...v1.4.1) (2026-09-07)


### Dependencies

* **deps-dev:** bump @wordpress/scripts to 34 and @wordpress/env to 11 ([#13](https://github.com/josephfusco/callboard/issues/13)) ([98ac56a](https://github.com/josephfusco/callboard/commit/98ac56a16d54b0703c40401ea78e34b7e04d4457))

## [1.4.0](https://github.com/josephfusco/callboard/compare/v1.3.2...v1.4.0) (2026-09-07)


### Features

* AirPlay and Cast from the deck ([#11](https://github.com/josephfusco/callboard/issues/11)) ([29618ec](https://github.com/josephfusco/callboard/commit/29618ec1649509c9d53268dd61dc9a774a87d503))
* share a set from its page ([#12](https://github.com/josephfusco/callboard/issues/12)) ([f86efba](https://github.com/josephfusco/callboard/commit/f86efba4be77587013ceb230d6debdf0e1cf50bf))
* speed chip slows playback and keeps the pitch ([#10](https://github.com/josephfusco/callboard/issues/10)) ([8cfc4ed](https://github.com/josephfusco/callboard/commit/8cfc4ed703dfc11754f291a8849210fa71c21717))


### Bug Fixes

* declare the license in the plugin header and mark tested up to 7.1 ([a50b072](https://github.com/josephfusco/callboard/commit/a50b0726ab724cdd431ba1e3d3e78bf165f97abb))
* haptics fire on iOS taps ([#9](https://github.com/josephfusco/callboard/issues/9)) ([8452c1c](https://github.com/josephfusco/callboard/commit/8452c1c82bc72dc13b25cc6fe632aaa16705325f))


### Dependencies

* **deps:** bump crate-ci/typos from 1.49.0 to 1.50.0 ([#1](https://github.com/josephfusco/callboard/issues/1)) ([6c42db5](https://github.com/josephfusco/callboard/commit/6c42db5426881121bc5ec0ed4623212725ed2244))

## 1.0.0
- First release: sets as posts, tracks as attachments, persistent player, installable app, offline saving, Web Push notices, WP-CLI fetching with yt-dlp, folder import.
