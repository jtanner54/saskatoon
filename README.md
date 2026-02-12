# Saskatoon

**A Firefox extension born out of pure frustration.**

I was binge-watching a series on Disney+ and every single time an episode ended, I had to:

1. Click "Next Episode"
2. Re-enter fullscreen because Disney+ kicks you out of it
3. Turn my subtitles back on because those get reset too

Every. Single. Episode.

After the 15th time doing this dance, I snapped and built Saskatoon. Now I just hit play and don't touch my keyboard until the season is over.

## What It Does

- **Auto-clicks "Next Episode"** — Detects the end-of-episode overlay and clicks through instantly so playback continues without interruption.
- **Re-enters fullscreen** — Disney+ drops you out of fullscreen between episodes. Saskatoon puts you right back in, automatically. It clicks Disney+'s own fullscreen button (via shadow DOM) so the player controls still work properly.
- **Re-enables subtitles** — If you had subtitles on, they stay on. Saskatoon remembers your subtitle language and re-applies it after each transition.

## Install

**[Get Saskatoon on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/saskatoon/)**

### One-Time Firefox Setup (for auto-fullscreen)

A setup guide will open automatically on first install. The short version:

1. Go to `about:config` in Firefox
2. Search for `full-screen-api.allow-trusted-requests-only`
3. Toggle it to `false`

This allows Saskatoon to programmatically restore fullscreen without requiring a click. Without this, Firefox blocks all programmatic fullscreen requests for security reasons.

Then just head to Disney+, start a series, enter fullscreen, and let Saskatoon handle the rest.

## Settings

Click the Saskatoon icon in your toolbar to toggle features on/off:

| Setting | Default | Description |
|---------|---------|-------------|
| Auto Next Episode | On | Automatically clicks "Next Episode" |
| Re-enter Fullscreen | On | Restores fullscreen after transitions |
| Re-enable Subtitles | On | Keeps your subtitles on between episodes |
| Subtitle Language | Auto-detect | Which subtitle track to re-enable |

## How It Works

Saskatoon uses a belt-and-suspenders approach to detect episode transitions:

- **MutationObserver** watches the DOM for the "Up Next" button appearing (primary)
- **Polling** checks every second as a fallback
- **Video `ended` event** catches the end of playback directly

For fullscreen restoration, it clicks Disney+'s own `<toggle-fullscreen>` web component (inside its shadow DOM) rather than calling `requestFullscreen()` directly. This ensures the player's internal state stays consistent and controls work normally on hover.

Subtitle state is tracked via the HTML5 TextTrack API near the end of each episode, then re-applied after the transition using Disney+'s subtitle picker UI.

## Files

```
saskatoon/
├── manifest.json    # Extension manifest (Manifest V2)
├── content.js       # Core logic — injected into disneyplus.com
├── background.js    # Handles window-level fullscreen + first-run setup
├── popup.html       # Settings popup UI
├── popup.js         # Settings persistence
├── setup.html       # First-run setup guide (full page)
├── setup.js         # Setup page interactions + confetti
└── icons/
    ├── icon-48.png
    └── icon-96.png
```

## Why "Saskatoon"?

No reason. It's just a fun word.

## License

MIT
