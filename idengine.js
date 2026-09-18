/* ── IDEngine: OCR a tracklist image, split it into artist/song, link out to search ── */

const SEARCH_SITES = [
    { name: 'youtube',    url: 'https://www.youtube.com/results?search_query=' },
    { name: 'soundcloud', url: 'https://soundcloud.com/search?q=' },
    { name: 'bandcamp',   url: 'https://bandcamp.com/search?q=' },
    { name: 'spotify',    url: 'https://open.spotify.com/search/' }
];

/* ---- parsing ---- */

// "1." / "01)" / "#3" / "00:12:34" / "[12:34]" at the head of a line
function stripLeadingIndex(line) {
    let s = line;
    s = s.replace(/^[\[\(]?\d{1,2}:\d{2}(?::\d{2})?[\]\)]?\s*[-–—]?\s*/, '');
    s = s.replace(/^#\d{1,3}\s+/, '');          // "#3 " — the hash makes it unambiguous
    s = s.replace(/^#?\d{1,3}\s*[.):\]]\s*/, '');
    s = s.replace(/^#?\d{1,3}\s+[-–—]\s+/, '');
    return s.trim();
}

// A spaced hyphen/dash is the reliable separator. An unspaced ASCII hyphen is not —
// it would split "Hi-Fi" and "Jay-Z" — but a bare en/em dash still is.
function splitArtistSong(text) {
    let m = text.match(/^(.*?)\s+[-–—]\s+(.*)$/);
    if (m) return [m[1], m[2]];
    m = text.match(/^(.*?)[–—](.*)$/);
    if (m) return [m[1], m[2]];
    return null;
}

// "Song (Original Mix) [2021]" -> "Song", for a cleaner search query only
function queryTitle(song) {
    let q = String(song).trim();
    let previous;
    do {
        previous = q;
        q = q.replace(/\s*[\(\[\{][^()\[\]{}]*[\)\]\}]\s*$/, '').trim();
    } while (q !== previous && q.length > 0);
    return q.length > 0 ? q : String(song).trim();
}

function hasContent(str) {
    return /[A-Za-z0-9]/.test(str);
}

function parseTracklist(text) {
    const entries = [];
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;

        const stripped = stripLeadingIndex(line);
        if (!stripped || !hasContent(stripped)) continue;   // rules, dividers, stray numbers

        const parts = splitArtistSong(stripped);
        if (parts && parts[0].trim() && parts[1].trim()) {
            entries.push({ artist: parts[0].trim(), song: parts[1].trim(), resolved: true });
        } else {
            // no separator — keep it rather than dropping it silently
            entries.push({ artist: 'Unknown', song: stripped, resolved: false });
        }
    }
    return entries;
}

function searchQuery(entry) {
    const title = queryTitle(entry.song);
    return entry.artist === 'Unknown' ? title : entry.artist + ' ' + title;
}

/* ---- OCR ---- */

function setStatus(text) {
    const el = document.getElementById('ocr-status');
    if (!text) { el.hidden = true; return; }
    el.textContent = text;
    el.hidden = false;
}

function revealTextStep(text) {
    document.getElementById('tracklist-text').value = text;
    document.getElementById('text-step').hidden = false;
}

async function runOCR(source) {
    setStatus('reading image…');

    if (typeof Tesseract === 'undefined') {
        setStatus('OCR engine failed to load — you can still type the tracklist below.');
        revealTextStep('');
        return;
    }

    try {
        const result = await Tesseract.recognize(source, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    setStatus('reading text… ' + Math.round((m.progress || 0) * 100) + '%');
                } else if (m.status) {
                    setStatus(m.status + '…');
                }
            }
        });
        const text = (result && result.data && result.data.text ? result.data.text : '').trim();
        setStatus(text ? 'done — check the text below.' : 'no text found — type it in below.');
        revealTextStep(text);
    } catch (err) {
        setStatus('could not read that image — type the tracklist below instead.');
        revealTextStep('');
    }
}

function showPreview(source) {
    const img = document.getElementById('image-preview');
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
    img.hidden = false;
}

function handleImage(file) {
    if (!file) return;
    showPreview(file);
    document.getElementById('ide-results').innerHTML = '';
    runOCR(file);
}

/* ---- results ---- */

function findTracks() {
    const container = document.getElementById('ide-results');
    container.innerHTML = '';

    const entries = parseTracklist(document.getElementById('tracklist-text').value);

    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'crate-empty';
        empty.textContent = 'Nothing to search yet — add some lines above.';
        container.appendChild(empty);
        return;
    }

    for (const entry of entries) {
        const card = document.createElement('div');
        card.className = 'track-card ide-card';

        const song = document.createElement('p');
        song.className = 'ide-song';
        song.textContent = entry.song;
        card.appendChild(song);

        const artist = document.createElement('p');
        artist.className = 'ide-artist' + (entry.resolved ? '' : ' unresolved');
        artist.textContent = entry.resolved ? entry.artist : 'artist not detected';
        card.appendChild(artist);

        const links = document.createElement('div');
        links.className = 'ide-links';
        const query = encodeURIComponent(searchQuery(entry));
        for (const site of SEARCH_SITES) {
            const a = document.createElement('a');
            a.href = site.url + query;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = site.name;
            links.appendChild(a);
        }
        card.appendChild(links);

        container.appendChild(card);
    }
}

/* ---- wiring ---- */

document.getElementById('image-upload').addEventListener('change', function (event) {
    handleImage(event.target.files && event.target.files[0]);
    event.target.value = '';   // so re-picking the same photo still fires
});

// desktop convenience — the file picker above stays the primary path on every device
document.addEventListener('paste', function (event) {
    const items = (event.clipboardData && event.clipboardData.items) || [];
    for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                event.preventDefault();
                handleImage(file);
            }
            return;
        }
    }
});
