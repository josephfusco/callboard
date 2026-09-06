=== Callboard ===
Contributors: josephfusco
Tags: audio, player, rehearsal, theatre, pwa
Requires at least: 6.5
Tested up to: 6.8
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Rehearsal tracks for a cast. Sets of audio, a persistent player, installable as a home-screen app.

== Description ==

Callboard turns a WordPress site into a small, private music app for a cast or choir: a home page of sets, a track list per set, a player that keeps playing while you move around, lock-screen controls, optional offline saving, and an "Add to Home Screen" flow on iPhone. The whole front end is rendered by the plugin, whatever theme is active, and the site is kept out of search engines.

= Sets and tracks =

A set is a post. Its tracks are audio files attached to it, ordered by drag and drop, titled in the Media Library. Set a featured image for lock-screen artwork. Credits and a source link live in the set's meta boxes.

= Import =

Drop a folder into `wp-content/uploads/callboard/<slug>/` containing audio files and a `manifest.json`, then Sets → Import. The companion fetch tools produce that folder from a YouTube playlist on your own machine; hosts that allow running binaries can do it server-side.

= Settings =

Site title is the app name. Sets → Settings holds the tagline, the home page footer note, an optional emoji badge on the playing track, and the confetti text released by triple-tapping a title.

== Changelog ==

= 1.0.0 =
* First release.
