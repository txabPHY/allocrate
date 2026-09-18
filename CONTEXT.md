# Allocrate — Project Context

## What it is
A web app for DJs to quickly sort their music library into custom bins/crates.
The core loop: tracks load one by one, user taps a coloured bin button to assign it, crate view updates live on the right. Built in vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, just three files opened directly in the browser.

## Stack
- `index.html` — layout and structure
- `style.css` — warm white background (#FAF9F5), coloured gradient bin buttons with Duolingo-style press effect, responsive two-column grid
- `app.js` — all logic

No backend, no npm, no dependencies. Keep it that way unless there's a strong reason not to.

## What's working
- Landing screen — shown on load, fades out when a file is imported; has logo, "import → sort → export" label row, and a prominent import button
- Help button — fixed `?` in the bottom-right corner, `openHelp()` stub ready for a modal
- Rekordbox XML import (parses TRACK nodes from COLLECTION, preserves original XML for export)
- Track sorting — one tap assigns a bin and moves to next track
- Multi-crate mode toggle — bins toggle on/off, next button confirms, `track.bin` becomes an array
- Preset bin groups (mood, timing, genre) with toggle pills — multiple can be active at once, deduped union
- Custom bin creation with golden-angle colour generation
- All 19 preset bins have unique vibrant gradients; custom bins use high-saturation 30° hue-sweep gradients
- Live crate view on the right, updates as you sort, each crate card has a coloured heading pill
- Progress bar and track counter
- Skip, undo, skipped tracks second pass
- Deezer audio preview — play/pause button on track card, 30s clip via JSONP, stale-request guard
- Finished state — when all tracks are sorted, sorting UI fades out and "all sorted." appears with a track/crate count and an "undo last" button
- Export — amends original rekordbox XML, injects an Allocrate playlist folder, downloads as allocrate-export.xml; idempotent on re-export

## Key data structures
- `tracks` — array of track objects: `{ name, artist, bpm, key, year, id, bin }` where `bin` is `null`, a string (quick mode), or an array of strings (multi-crate mode)
- `presets` — `{ mood, timing, genre }` each an array of `{ name, bg, text, shadow }` bin definitions
- `customBins` — user-added bins, always appended after preset bins
- `activePresets` — Set of which preset group keys are currently toggled on
- `originalXML` — raw string of the imported rekordbox XML, used as base for export
- `currentQueue` — either `tracks` or `skippedTracks` depending on which pass we're on
- `currentIndex` — pointer into `currentQueue`
- `isFinished` — boolean, true when all tracks in the current queue have been processed

## Next steps
- Deploy on GitHub Pages
- Help modal (openHelp stub is in place)
- "More info" toggle on track card (bpm, key, year already on track objects, just need surfacing)
- Serato support
- Plain folder/file import for non-rekordbox users
- Save session state to localStorage so progress survives tab close
