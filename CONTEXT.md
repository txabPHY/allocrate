# Allocrate — Project Context

## What it is
A web app for DJs to quickly sort their music library into custom bins/crates.
The core loop: tracks load one by one, user taps a coloured bin button to assign it, crate view updates live on the right. Built in vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, just three files opened directly in the browser.

## Stack
Two tools, shared `style.css`. The page titles are the nav: "allocrate" and "IDEngine" sit side by side at heading size, with the current one dark and the other muted. Deployed at https://allocrate.app/ from the GitHub repo (so it runs over HTTPS, not file://).
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
- Image via `<input accept="image/*">` with **no** `capture` attribute — `capture` forces iOS straight into the camera; without it iOS offers Photo Library / Take Photo / Choose File. Plus paste-from-clipboard on desktop
- Tesseract.js v5 via CDN does OCR client-side; text lands in an editable textarea so OCR mistakes can be fixed before searching
- Parser finds track *boundaries* first, on the whole text flattened (so OCR line-wraps mid-track don't matter): timestamps if there are 2+, otherwise a run of **consecutive** track numbers (3+). Sequence is what tells "20 Burnski" (track number) from "Vic 20 & Sinclair" (name). Tolerates one missed number. Falls back to one-track-per-line for unnumbered lists.
- "Tracklist:" style headers are dropped; trailing `*` markers stripped
- `w/`, `x` and `vs.` split a chunk into separate tracks only when *both* sides have their own "Artist - Song" — so "A - B w/ C - D" is two tracks but "Overmono vs. Lil Baby - BBY" stays one
- Within each chunk: split on a spaced hyphen or en/em dash (unspaced ASCII hyphens never split, so "Jay-Z" survives); no separator → artist "Unknown" rather than dropped
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
Full plan: "Allocrate Plan" doc. Direction: grow Allocrate into one library for every track a DJ cares about, owned or wanted, with sorting and IDEngine as tools on top. Quick and easy is the selling point. Stay vanilla JS; Supabase arrives in phase 4.

### Quick wins (do first)
- [ ] Keyboard shortcuts on the sort screen: 1-9 assign bins, then 0 and letters for extra bins, space = skip, backspace = undo. Show each key on its bin button.
- [ ] Share preview tags: `og:title`, `og:description`, `og:image` (logo) in the `<head>` of index.html and idengine.html.
- [ ] Feedback link: small "found a bug / got a suggestion" link (mailto or Google Form).
- [ ] README: what it is, a screenshot, link to https://allocrate.app/.

### Phase 1: library structure and one import button
- [ ] Restructure data into `tracks`, `crates`, `crateTracks` (see data model below). Each track gets `status` (owned / wanted), `ownedVia` (rekordbox / file / manual), `matchKey`, `addedAt`.
- [ ] Merge the import buttons into one that detects input: `.xml` → rekordbox, audio files → tags, image → OCR tracklist, text → tracklist. Owned for files/XML, wanted for tracklists.
- [ ] Dedupe on `matchKey` (lowercase, strip punctuation, drop "Original Mix", move "feat." out of title). A repeat adds a sighting, not a new track.
- [ ] Inbox = tracks in no crate. The sorter works through the inbox.
- [ ] Save library to localStorage so it survives tab close.

### Phase 2: library tab
- [ ] New tab beside allocrate and IDEngine. Views: all, by crate, recently added, owned / wanted, by source, inbox.
- [ ] Search links on every track (Spotify, Apple Music, YouTube, Bandcamp, Discogs, Beatport, Google), built from artist + title.
- [ ] Add a track by hand ("Artist - Title" or a link).
- [ ] Crates can hold wanted tracks.

### Phase 3: sorting arena
- [ ] Mobile: track card on top, crate tiles below, drag the card into a crate. Tap a crate to open it.
- [ ] Sort from any view: inbox, one crate, only wanted tracks.
- [ ] Keep tap-to-sort as desktop default.

### Phase 4: accounts
- [ ] Supabase login and database via script tag (no build tools). Guest mode keeps working; guest data imports on sign-up.
- [ ] Privacy policy and delete-my-data option.

### Phase 5: matching purchases
- [ ] Wanted track appears in a new import: same `matchKey` → merge automatically; close match → ask the user to confirm. Merged track keeps its crates and sightings.

### Phase 6: IDEngine into the library
- [ ] Parsed tracklists save as `tracklists` + entries; tracks land as wanted. Preview table before adding.
- [ ] iTunes Search API via JSONP for match, artwork, 30s preview, Apple link (no key).

### Planned data model (for phase 4, mirror it in localStorage before then)
- `tracks`: id, user_id, artist, title, version, label, match_key, status, owned_via, file_name, rekordbox_id, location, bpm, key, year, itunes_id, preview_url, artwork_url, added_at
- `sightings`: track_id, source_type, tracklist_id, seen_at
- `tracklists`: id, user_id, title, dj, date, url, raw_text
- `tracklist_entries`: tracklist_id, position, timestamp, track_id (null for "?"), raw_line
- `crates`: id, user_id, name, colour, group
- `crate_tracks`: crate_id, track_id

### Parked
- Serato support
- Better export for file-imported tracks (absolute paths), see known limitations
- Service connections (YouTube, Discogs possible; Spotify and Bandcamp effectively closed)
- CDJ USB export: leave to rekordbox via XML
- Plain-English parsing instructions via an AI model

## Known limitations
- File-import XML exports have no absolute `Location` — browsers never expose absolute paths, so rekordbox may not relink those tracks. Workarounds: use "export crates" (the script builds real folders), or rekordbox's own Relocate. XML imports are unaffected, since their absolute paths come from the source file.
- `create-folders.sh` is POSIX sh, so macOS/Linux only. No Windows .bat equivalent yet.
- The help popup is hover-driven, so it does not open on touch devices.
