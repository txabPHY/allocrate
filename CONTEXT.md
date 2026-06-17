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
- Rekordbox XML import (parses TRACK nodes from COLLECTION, preserves original XML for export)
- Track sorting — one tap assigns a bin and moves to next track
- Multi-crate mode toggle — bins toggle on/off, next button confirms, track.bin becomes an array
- Custom bin creation with golden-angle colour generation
- Preset bin groups (mood, timing, genre) with toggle pills — multiple can be active at once
- Live crate view on the right, updates as you sort, each crate is a card with a coloured heading pill
- Progress bar and track counter
- Skip, undo, skipped tracks second pass
- Deezer preview — play button on track card fetches 30s preview via JSONP
- Export — amends original rekordbox XML, injects an Allocrate playlist folder, downloads as allocrate-export.xml

## Key data structures
- `tracks` — array of track objects: `{ name, artist, bpm, key, year, id, bin }` where bin is null, a string, or an array
- `bins` — array of bin objects: `{ name, bg, text, shadow }` — drives both button rendering and crate view colours
- `originalXML` — raw string of the imported rekordbox XML, used as base for export
- `currentQueue` — either tracks or skippedTracks depending on which pass we're on
- `currentIndex` — pointer into currentQueue

## Next steps
- Deploy on GitHub Pages
- "More info" toggle on track card (bpm, key, year already on track objects, just need surfacing)
- Serato support
- Plain folder/file import for non-rekordbox users
- Save session state to localStorage so progress survives tab close