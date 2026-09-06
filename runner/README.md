# Callboard runner

Managed WordPress hosts can't run yt-dlp, so this small runner does the fetching from your own machine (or a CI job) and pushes finished sets to the site.

Requirements: `yt-dlp`, `ffmpeg`, `python3` with `pip install -r requirements.txt`. On a Mac: `brew install yt-dlp ffmpeg`.

    python3 runner.py --site https://example.com --user yourname --watch

Create an application password under Users → Profile → Application Passwords and paste it when asked (or set `CALLBOARD_PASSWORD`). The runner polls the site for queued requests from Sets → Import → "From YouTube", fetches audio only, builds the cover and share card, uploads everything, and the set goes live.

Build a set by hand instead:

    ./fetch.sh spring-show 'https://www.youtube.com/playlist?list=…' "Spring Show"

Then copy `audio/spring-show/` to `wp-content/uploads/callboard/` and use Sets → Import.

`CALLBOARD_SITE` and `CALLBOARD_LABEL` set the text drawn on the artwork.
