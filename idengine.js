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

const HEADER_LINE = /^\s*(?:track\s*list|set\s*list|play\s*list)\s*:?\s*$/i;

function removeHeaders(text) {
    return String(text)
        .split(/\r?\n/)
        .filter(line => !HEADER_LINE.test(line))
        .join('\n')
        .replace(/^\s*(?:track\s*list|set\s*list|play\s*list)\s*:\s*/i, '');
}

// Cut `flat` at each boundary, dropping the boundary token itself (a number or timestamp).
function cutAt(flat, boundaries) {
    const chunks = [flat.slice(0, boundaries[0].start)];   // anything before the first boundary
    boundaries.forEach((b, i) => {
        const next = i + 1 < boundaries.length ? boundaries[i + 1].start : flat.length;
        chunks.push(flat.slice(b.end, next));
    });
    return chunks;
}

function timestampBoundaries(flat) {
    const re = /(^|\s)[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?(?=\s)/g;
    const found = [];
    let m;
    while ((m = re.exec(flat))) found.push({ start: m.index + m[1].length, end: re.lastIndex });
    return found.length >= 2 ? found : null;
}

// Track numbers are only trusted as boundaries when they run in sequence, which is what
// separates "7 Vic 20 & Sinclair" (20 is part of the name) from "20 Burnski" (a track number).
function numberChainBoundaries(flat) {
    const re = /(^|\s)(\d{1,3})[.)]?(?=\s+\D)/g;
    const cands = [];
    let m;
    while ((m = re.exec(flat))) {
        cands.push({ value: Number(m[2]), start: m.index + m[1].length, end: re.lastIndex });
    }

    const firstIndex = (from, value) => {
        for (let j = from; j < cands.length; j++) if (cands[j].value === value) return j;
        return -1;
    };

    let best = [];
    for (let i = 0; i < cands.length; i++) {
        const chain = [cands[i]];
        let k = i;
        while (true) {
            const expected = cands[k].value + 1;
            const exact = firstIndex(k + 1, expected);
            const skip = firstIndex(k + 1, expected + 1);   // tolerate one number OCR missed
            let next = -1;
            if (exact >= 0 && (skip < 0 || exact < skip)) {
                next = exact;
            } else if (skip >= 0) {
                // the exact number turns up after a stray "expected+1" inside a title
                // ("... Area 7 6 Next Artist") — take it unless the sequence has moved on past it
                const movedOn = firstIndex(skip + 1, expected + 2);
                next = exact >= 0 && (movedOn < 0 || exact < movedOn) ? exact : skip;
            }
            if (next < 0) break;
            chain.push(cands[next]);
            k = next;
        }
        if (chain.length > best.length) best = chain;
    }
    return best.length >= 3 ? best : null;
}

function splitIntoChunks(text) {
    const cleaned = removeHeaders(text);
    const flat = cleaned.replace(/\s+/g, ' ').trim();   // wrapped lines rejoin before boundary search
    if (!flat) return [];

    const byTime = timestampBoundaries(flat);
    if (byTime) return cutAt(flat, byTime);

    const byNumber = numberChainBoundaries(flat);
    if (byNumber) return cutAt(flat, byNumber);

    return cleaned.split(/\r?\n/);   // unnumbered list: one track per line
}

const MASHUP = /(\s+(?:w\/|x|vs\.?)\s+)/i;

// "A - Song w/ B - Other" is two tracks, but "Overmono vs. Lil Baby - BBY" is one —
// only split where the pieces on both sides each have their own artist/song separator.
function splitMashups(chunk) {
    const parts = chunk.split(MASHUP);
    const out = [parts[0]];
    for (let i = 1; i < parts.length; i += 2) {
        const joiner = parts[i];
        const piece = parts[i + 1];
        if (splitArtistSong(piece) && splitArtistSong(out[out.length - 1])) {
            out.push(piece);
        } else {
            out[out.length - 1] += joiner + piece;
        }
    }
    return out;
}

function parseTracklist(text) {
    const entries = [];
    for (const chunk of splitIntoChunks(text)) {
        const line = chunk.replace(/\s+/g, ' ').trim().replace(/\s*\*+$/, '');   // "*" = unreleased marker
        if (!line) continue;

        for (const piece of splitMashups(line)) {
            const stripped = stripLeadingIndex(piece.trim());
            if (!stripped || !hasContent(stripped)) continue;   // rules, dividers, stray numbers

            const parts = splitArtistSong(stripped);
            if (parts && parts[0].trim() && parts[1].trim()) {
                entries.push({ artist: parts[0].trim(), song: parts[1].trim(), resolved: true });
            } else {
                // no separator — keep it rather than dropping it silently
                entries.push({ artist: 'Unknown', song: stripped, resolved: false });
            }
        }
    }
    return entries;
}

function searchQuery(entry) {
    const title = queryTitle(entry.song);
    return /^unknown(?: artist)?$/i.test(entry.artist) ? title : entry.artist + ' ' + title;
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
    // leave the centred landing layout and open the workspace below the button
    document.body.classList.add('has-image');
    document.getElementById('ide-workspace').hidden = false;
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
