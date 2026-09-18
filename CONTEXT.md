# Allocrate — Project Context

## What it is
A web app for DJs to quickly sort their music library into custom bins/crates.
The core loop: tracks load one by one, user taps a coloured bin button to assign it, crate view updates live on the right. Built in vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, just three files opened directly in the browser.

## Stack
Two tools, shared `style.css`, nav bar switches between them. Deployed at https://allocrate.app/ from the GitHub repo (so it runs over HTTPS, not file://).
- `index.html` / `app.js` — the sorter
- `idengine.html` / `idengine.js` — OCR a tracklist photo into search links
- `index.html` — layout and structure
- `style.css` — warm white background (#FAF9F5), coloured gradient bin buttons with Duolingo-style press effect, responsive two-column grid
- `app.js` — all logic

No backend, no npm, no dependencies. Keep it that way unless there's a strong reason not to.

## What's working
- Landing screen — shown on load, fades out when a file is imported; has logo, "import → sort → export" label row, and a prominent import button
- Help button — fixed `?` bottom-right on both the landing and the app; hover reveals a card explaining the app, with an invisible bridge element so moving cursor → popup never flickers
- Rekordbox XML import (parses TRACK nodes from COLLECTION, preserves original XML for export)
- File/folder import — reads ID3 tags locally via jsmediatags (CDN), no audio is uploaded; falls back to "Artist - Title" filename parsing when tags are missing; skips non-audio and dotfiles
- Track sorting — one tap assigns a bin and moves to next track
- Multi-crate mode toggle — bins toggle on/off, next button confirms, `track.bin` becomes an array
- Preset bin groups (mood, timing, genre) with toggle pills — multiple can be active at once, deduped union
- Custom bin creation with golden-angle colour generation
- All 19 preset bins have unique vibrant gradients; custom bins use high-saturation 30° hue-sweep gradients
- Live crate view on the right, updates as you sort, each crate card has a coloured heading pill
- Progress bar and track counter
- Skip, undo, skipped tracks second pass
- "more info" toggle on the track card reveals bpm/key/year, hides fields that are empty, hides itself when a track has none, resets collapsed per track
- Deezer audio preview — play/pause button on track card, 30s clip via JSONP, stale-request guard
- Finished state — when all tracks are sorted, sorting UI fades out and "all sorted." appears with a track/crate count and an "undo last" button
- Export XML — amends the original when one was imported, or synthesises a fresh rekordbox document when tracks came from file import. Idempotent on re-export.
- Export crates — a zip containing one `.m3u8` per crate plus `create-folders.sh`, which builds an `Allocrate/` folder of subfolders filled with **symlinks** (nothing copied or moved, ~0 bytes). Uses absolute paths for XML imports and script-relative paths for file imports. Zip is written by a built-in stored-mode writer, no dependency.

## IDEngine
- Image via `<input accept="image/*" capture="environment">` (camera or library on mobile), plus paste-from-clipboard on desktop
- Tesseract.js v5 via CDN does OCR client-side; text lands in an editable textarea so OCR mistakes can be fixed before searching
- Parser strips leading track numbers/timestamps ("1.", "01)", "#3", "00:12:34"), splits on a spaced hyphen or an en/em dash, and keeps unsplittable lines as artist "Unknown" rather than dropping them. Unspaced ASCII hyphens are never split on, so "Jay-Z" and "Hi-Fi Sean" survive.
- Trailing brackets are stripped from the *search query* only ("Le Tigre (Original Mix)" searches as "Le Tigre"); the card still shows the full title
- Each result card links to YouTube, SoundCloud, Bandcamp and Spotify searches

## Key data structures
- `tracks` — array of track objects: `{ name, artist, bpm, key, year, id, bin }` where `bin` is `null`, a string (quick mode), or an array of strings (multi-crate mode)
- `presets` — `{ mood, timing, genre }` each an array of `{ name, bg, text, shadow }` bin definitions
- `customBins` — user-added bins, always appended after preset bins
- `activePresets` — Set of which preset group keys are currently toggled on
- `originalXML` — raw string of the imported rekordbox XML; **null** after a file/folder import, which switches export to the fresh-document path
- `importedFromFiles` — selects absolute vs script-relative paths in the crate export
- `track.location` — absolute path decoded from the XML's `Location` attribute, or (file import) the path relative to the folder that was picked
- `currentQueue` — either `tracks` or `skippedTracks` depending on which pass we're on
- `currentIndex` — pointer into `currentQueue`
- `isFinished` — boolean, true when all tracks in the current queue have been processed

## Next steps
- Deploy on GitHub Pages
- Serato support
- Save session state to localStorage so progress survives tab close

## Known limitations
- File-import XML exports have no absolute `Location` — browsers never expose absolute paths, so rekordbox may not relink those tracks. Workarounds: use "export crates" (the script builds real folders), or rekordbox's own Relocate. XML imports are unaffected, since their absolute paths come from the source file.
- `create-folders.sh` is POSIX sh, so macOS/Linux only. No Windows .bat equivalent yet.
- The help popup is hover-driven, so it does not open on touch devices.
