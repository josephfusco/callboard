# Contributing

```bash
npm install && composer install
npm run env:start          # WordPress at http://localhost:8890 (admin / password), fixtures imported
npm run lint               # PHPCS (WordPress Coding Standards) + ESLint
npm run test:e2e           # Playwright, desktop + iPhone viewport
```

The plugin renders the whole front end and ships one stylesheet and one script with no build step. Keep it that way: transform/opacity animations only, no font-weight changes for state, native controls first.

Fetching from YouTube needs `yt-dlp` (and `ffmpeg` for mp3) wherever WP-CLI runs: `wp callboard doctor` tells you what's available.
