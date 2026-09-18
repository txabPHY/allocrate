let originalXML = null;

let tracks = [];

const presets = {
    mood: [
        { name: "dark",        bg: "linear-gradient(135deg, #3B1F8C, #0E0028)", text: "#C4B5FD", shadow: "#07001A" },
        { name: "euphoric",    bg: "linear-gradient(135deg, #FF3D9A, #C80052)", text: "#fff",    shadow: "#8A0038" },
        { name: "groovy",      bg: "linear-gradient(135deg, #A855F7, #6200D0)", text: "#fff",    shadow: "#430090" },
        { name: "melancholic", bg: "linear-gradient(135deg, #6EB8FF, #0032CC)", text: "#fff",    shadow: "#001FA0" },
        { name: "uplifting",   bg: "linear-gradient(135deg, #FFD740, #FF7A00)", text: "#3d1800", shadow: "#CC5500" },
        { name: "hypnotic",    bg: "linear-gradient(135deg, #00F0C0, #0099C6)", text: "#003830", shadow: "#007090" }
    ],
    timing: [
        { name: "warm up",     bg: "linear-gradient(135deg, #69FF9E, #00A850)", text: "#023520", shadow: "#007A3A" },
        { name: "rolling",     bg: "linear-gradient(135deg, #FF9500, #CC3300)", text: "#fff",    shadow: "#8A2200" },
        { name: "peak time",   bg: "linear-gradient(135deg, #FF5757, #CC0011)", text: "#fff",    shadow: "#8C000B" },
        { name: "closing",     bg: "linear-gradient(135deg, #2D1B00, #0A0400)", text: "#D4A76A", shadow: "#050200" },
        { name: "after hours", bg: "linear-gradient(135deg, #7878FF, #3000AA)", text: "#fff",    shadow: "#200075" }
    ],
    genre: [
        { name: "house",       bg: "linear-gradient(135deg, #FF7860, #E00028)", text: "#fff",    shadow: "#9E001C" },
        { name: "techno",      bg: "linear-gradient(135deg, #1A2744, #050912)", text: "#6B8BB0", shadow: "#020509" },
        { name: "garage",      bg: "linear-gradient(135deg, #00E8A8, #00845E)", text: "#012922", shadow: "#006044" },
        { name: "drum & bass", bg: "linear-gradient(135deg, #E950F8, #7800A8)", text: "#fff",    shadow: "#500070" },
        { name: "jungle",      bg: "linear-gradient(135deg, #AAFF00, #3C8C00)", text: "#1a2e05", shadow: "#2A6200" },
        { name: "disco",       bg: "linear-gradient(135deg, #FFE53B, #E08000)", text: "#3d1800", shadow: "#A85A00" },
        { name: "ambient",     bg: "linear-gradient(135deg, #38B6FF, #0044CC)", text: "#fff",    shadow: "#0030A0" },
        { name: "breaks",      bg: "linear-gradient(135deg, #FF44CC, #880066)", text: "#fff",    shadow: "#5E0047" }
    ]
};
let activePresets = new Set(['mood']);
let customBins = [];

let customBinCount = 0;

function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
    };
    return [f(0), f(8), f(4)];
}

function nextBinColour() {
    const hue = (25 + customBinCount * 137.5) % 360;
    customBinCount++;

    const bg = `linear-gradient(135deg, hsl(${hue}, 90%, 65%), hsl(${(hue + 30) % 360}, 95%, 42%))`;
    const shadow = `hsl(${(hue + 15) % 360}, 90%, 28%)`;

    const [r, g, b] = hslToRgb(hue, 90, 54);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const text = brightness > 150 ? "#1a1a1a" : "#fff";

    return { bg, text, shadow };
}

let skippedTracks = [];
let currentQueue = tracks;
let currentIndex = 0;
let multiMode = false;
let selectedBins = [];
let isFinished = false;
let moreInfoOpen = false;
let importedFromFiles = false;

const previewAudio = new Audio();
let previewUrl = null;
let previewRequestId = 0;

previewAudio.onended = function () {
    const btn = document.getElementById('preview-btn');
    if (btn) btn.textContent = '▶';
};

function jsonp(url, callback) {
    const cbName = '__deezer_' + Date.now();
    window[cbName] = function (data) {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        callback(data);
    };
    const script = document.createElement('script');
    script.onerror = function () {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        callback(null);
    };
    script.src = url + '&callback=' + cbName;
    document.head.appendChild(script);
}

function loadPreview(track) {
    stopPreview();
    previewUrl = null;
    document.getElementById('preview-btn').disabled = true;
    document.getElementById('no-preview-msg').textContent = '';

    const reqId = ++previewRequestId;
    const q = encodeURIComponent(`artist:"${track.artist}" track:"${track.name}"`);

    jsonp(`https://api.deezer.com/search?q=${q}&limit=1&output=jsonp`, function (data) {
        if (reqId !== previewRequestId) return;
        const btn = document.getElementById('preview-btn');
        const msg = document.getElementById('no-preview-msg');
        if (data && data.data && data.data.length > 0 && data.data[0].preview) {
            previewUrl = data.data[0].preview;
            btn.disabled = false;
        } else {
            msg.textContent = 'no preview available';
        }
    });
}

function togglePreview() {
    if (!previewUrl) return;
    const btn = document.getElementById('preview-btn');
    if (previewAudio.paused) {
        previewAudio.src = previewUrl;
        previewAudio.play();
        btn.textContent = '⏸';
    } else {
        previewAudio.pause();
        btn.textContent = '▶';
    }
}

function stopPreview() {
    previewAudio.pause();
    const btn = document.getElementById('preview-btn');
    if (btn) btn.textContent = '▶';
}


function parseRekordboxXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const collection = doc.getElementsByTagName("COLLECTION")[0];
    if (!collection) return [];

    const trackNodes = collection.getElementsByTagName("TRACK");
    const parsed = [];

    for (const node of trackNodes) {
        parsed.push({
            name:   node.getAttribute("Name") || "Unknown",
            artist: node.getAttribute("Artist") || "Unknown",
            bpm:    node.getAttribute("AverageBpm") || "",
            key:    node.getAttribute("Tonality") || "",
            year:   node.getAttribute("Year") || "",
            id:     node.getAttribute("TrackID") || "",
            location: decodeLocation(node.getAttribute("Location")),
            bin: null
        });
    }

    return parsed;
}

function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
        originalXML = reader.result;
        importedFromFiles = false;
        const parsed = parseRekordboxXML(reader.result);
        if (parsed.length === 0) {
            alert("No tracks found. Is this a rekordbox collection XML?");
            return;
        }
        dismissLanding();
        loadTracks(parsed);
    };
    reader.readAsText(file);
}

/* ── Folder / file import (reads ID3 tags locally, nothing is uploaded) ── */

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aiff', '.aif', '.flac', '.m4a', '.aac'];

function isAudioFile(file) {
    // leading dot catches .DS_Store and macOS "._name.mp3" resource forks
    if (file.name.startsWith('.')) return false;
    const lower = file.name.toLowerCase();
    return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function readTags(file) {
    return new Promise(resolve => {
        if (typeof jsmediatags === 'undefined') {
            resolve(null);
            return;
        }
        try {
            jsmediatags.read(file, {
                onSuccess: result => resolve(result && result.tags ? result.tags : null),
                onError: () => resolve(null)
            });
        } catch (err) {
            resolve(null);
        }
    });
}

// Frames arrive as plain strings, {data: ...}, or arrays of either — flatten to text.
function frameText(frame) {
    if (frame === undefined || frame === null) return '';
    if (typeof frame === 'string') return frame.trim();
    if (typeof frame === 'number') return String(frame);
    if (Array.isArray(frame)) {
        for (const entry of frame) {
            const value = frameText(entry);
            if (value) return value;
        }
        return '';
    }
    if (typeof frame === 'object' && frame.data !== undefined) return frameText(frame.data);
    return '';
}

// TXXX holds user-defined frames; Mixed In Key writes INITIALKEY/BPM here.
function txxxValue(tags, wantedDescription) {
    const raw = tags.TXXX;
    if (!raw) return '';
    const list = Array.isArray(raw) ? raw : [raw];
    for (const frame of list) {
        const payload = frame && frame.data;
        if (!payload || typeof payload !== 'object') continue;
        const description = String(payload.user_description || '').toLowerCase().replace(/[^a-z]/g, '');
        if (description === wantedDescription) return String(payload.data || '').trim();
    }
    return '';
}

function tagBpm(tags) {
    const raw = frameText(tags.TBPM) || txxxValue(tags, 'bpm') || txxxValue(tags, 'tempo');
    const parsed = parseFloat(raw);
    return isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function tagKey(tags) {
    return frameText(tags.TKEY) || txxxValue(tags, 'initialkey') || txxxValue(tags, 'key');
}

function tagYear(tags) {
    const raw = frameText(tags.year) || frameText(tags.TYER) || frameText(tags.TDRC) || frameText(tags.TDRL);
    const match = String(raw).match(/\d{4}/);
    return match ? match[0] : '';
}

// "Artist - Title.mp3" → {artist, name}; anything else keeps the whole stem as the name.
function fromFilename(file) {
    const stem = file.name.replace(/\.[^.]+$/, '').trim();
    const parts = stem.split(' - ');
    if (parts.length >= 2 && parts[0].trim()) {
        return { artist: parts[0].trim(), name: parts.slice(1).join(' - ').trim() };
    }
    return { artist: 'Unknown', name: stem };
}

function buildTrackFromFile(file, tags, id) {
    const fallback = fromFilename(file);
    const title = tags ? frameText(tags.title) : '';
    const artist = tags ? frameText(tags.artist) : '';
    return {
        name:   title || fallback.name,
        artist: artist || fallback.artist,
        bpm:    tags ? tagBpm(tags) : '',
        key:    tags ? tagKey(tags) : '',
        year:   tags ? tagYear(tags) : '',
        id:     String(id),
        // relative to the imported folder root; browsers never expose absolute paths
        location: relativeInsideRoot(file),
        bin: null
    };
}

// Bounded concurrency: a whole library at once would spawn thousands of FileReaders.
async function readAllTags(files, onProgress) {
    const CONCURRENCY = 8;
    const results = new Array(files.length);
    let cursor = 0;
    let completed = 0;

    async function worker() {
        while (cursor < files.length) {
            const index = cursor++;
            results[index] = await readTags(files[index]);
            completed++;
            if (completed % 10 === 0 || completed === files.length) {
                onProgress(completed, files.length);
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, files.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
}

function showImportStatus(text) {
    const el = document.getElementById('import-status');
    el.textContent = text;
    el.hidden = false;
}

function hideImportStatus() {
    document.getElementById('import-status').hidden = true;
}

async function handleFolderUpload(event) {
    const selected = Array.from(event.target.files || []);
    const audioFiles = selected.filter(isAudioFile);
    event.target.value = '';  // so picking the same folder again still fires onchange

    if (audioFiles.length === 0) {
        alert('No supported audio files found.\nSupported: mp3, wav, aiff, flac, m4a, aac.');
        return;
    }

    showImportStatus(`reading tags… 0 / ${audioFiles.length}`);
    const tagList = await readAllTags(audioFiles, (done, total) => {
        showImportStatus(`reading tags… ${done} / ${total}`);
    });

    const parsed = audioFiles.map((file, i) => buildTrackFromFile(file, tagList[i], i + 1));

    hideImportStatus();
    originalXML = null;   // nothing to amend — export will build a fresh document
    importedFromFiles = true;
    dismissLanding();
    loadTracks(parsed);
}

function loadTracks(newTracks) {
    tracks = newTracks;
    currentQueue = tracks;
    currentIndex = 0;
    skippedTracks = [];
    showCrateView();
    showTrack();
}

function showTrack() {
    if (currentQueue.length === 0) return;

    isFinished = false;
    document.getElementById('sorting-ui').classList.remove('hidden');
    document.getElementById('finished-state').classList.remove('visible');

    const card = document.querySelector('.track-card');
    card.classList.remove('animate');
    void card.offsetWidth;
    card.classList.add('animate');

    selectedBins = [];
    document.getElementById('next-btn').hidden = true;
    if (multiMode) renderBins();

    const track = currentQueue[currentIndex];
    document.getElementById('track-name').textContent = track.name;
    document.getElementById('track-artist').textContent = track.artist;
    moreInfoOpen = false;
    renderTrackDetails();
    loadPreview(track);

    document.getElementById('track-counter').textContent = (currentIndex + 1) + ' / ' + currentQueue.length;
    document.getElementById('progress-fill').style.width = (currentIndex / currentQueue.length * 100) + '%';
}

function selectBin(bin_name) {
    if (!multiMode) {
        const track = currentQueue[currentIndex];
        track.bin = bin_name;
        showCrateView();
        currentIndex++;
        if (currentIndex >= currentQueue.length) {
            if (skippedTracks.length > 0) {
                goToSkipped();
                return;
            }
            showFinished();
            return;
        }
        showTrack();
        return;
    }

    const idx = selectedBins.indexOf(bin_name);
    if (idx === -1) {
        selectedBins.push(bin_name);
    } else {
        selectedBins.splice(idx, 1);
    }
    renderBins();
    document.getElementById('next-btn').hidden = selectedBins.length === 0;
}

function confirmMultiSelection() {
    if (selectedBins.length === 0) return;
    const track = currentQueue[currentIndex];
    track.bin = [...selectedBins];
    selectedBins = [];
    showCrateView();
    document.getElementById('next-btn').hidden = true;
    currentIndex++;
    if (currentIndex >= currentQueue.length) {
        if (skippedTracks.length > 0) {
            goToSkipped();
            return;
        }
        showFinished();
        return;
    }
    showTrack();
}

function skipTrack() {
    skippedTracks.push(currentQueue[currentIndex]);
    currentIndex = currentIndex + 1;
    if (currentIndex >= currentQueue.length) {
        if (skippedTracks.length > 0) {
            goToSkipped();
            return;
        }
        showFinished();
        return;
    }
    showTrack();
}

function goToSkipped() {
    currentQueue = skippedTracks;
    skippedTracks = [];
    currentIndex = 0;
    showTrack();
}

function goBack() {
    currentIndex = currentIndex - 1;
    if (currentIndex < 0) {
        currentIndex = 0;
        if (isFinished) {
            isFinished = false;
            document.getElementById('sorting-ui').classList.remove('hidden');
            document.getElementById('finished-state').classList.remove('visible');
        }
        return;
    }
    const track = currentQueue[currentIndex];
    track.bin = null;
    showCrateView();
    showTrack();
}

function showCrateView() {
    const crateView = document.getElementById("crate-view");
    crateView.innerHTML = "";

    let crates = {};
    for (let track of tracks) {
        if (!track.bin) continue;
        const binNames = Array.isArray(track.bin) ? track.bin : [track.bin];
        for (const bin of binNames) {
            if (!crates[bin]) crates[bin] = [];
            crates[bin].push(track);
        }
    }

    if (Object.keys(crates).length === 0) {
        const empty = document.createElement("p");
        empty.className = "crate-empty";
        empty.textContent = "Tracks you sort will show up here.";
        crateView.appendChild(empty);
        return;
    }

    for (const [bin, binTracks] of Object.entries(crates)) {
        const card = document.createElement("div");
        card.className = "crate-card";

        const heading = document.createElement("h3");
        heading.textContent = `${bin} (${binTracks.length})`;
        const binData = findBinData(bin);
        heading.style.background = binData ? binData.bg : "#E9E6DD";
        heading.style.color = binData ? binData.text : "#2B2A26";
        card.appendChild(heading);

        for (const track of binTracks) {
            const song = document.createElement("p");
            song.textContent = `${track.name} - ${track.artist}`;
            card.appendChild(song);
        }

        crateView.appendChild(card);
    }

    updateExportButton();
}

function showFinished() {
    isFinished = true;
    stopPreview();
    selectedBins = [];
    document.getElementById('next-btn').hidden = true;
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('track-counter').textContent = currentQueue.length + ' / ' + currentQueue.length;

    const binnedTracks = tracks.filter(t => t.bin && (!Array.isArray(t.bin) || t.bin.length > 0));
    const crateNames = new Set();
    for (const track of binnedTracks) {
        const bins = Array.isArray(track.bin) ? track.bin : [track.bin];
        for (const b of bins) crateNames.add(b);
    }
    const tc = binnedTracks.length;
    const cc = crateNames.size;
    document.getElementById('finished-subtitle').textContent =
        `${tc} track${tc !== 1 ? 's' : ''} across ${cc} crate${cc !== 1 ? 's' : ''}`;

    document.getElementById('sorting-ui').classList.add('hidden');
    document.getElementById('finished-state').classList.add('visible');
}

function updateExportButton() {
    const hasBin = tracks.some(t => t.bin && (!Array.isArray(t.bin) || t.bin.length > 0));
    document.getElementById('export-btn').disabled = !hasBin;
    document.getElementById('export-crates-btn').disabled = !hasBin;
}

function buildCrates() {
    const crates = {};
    for (const track of tracks) {
        if (!track.bin || !track.id) continue;
        const binNames = Array.isArray(track.bin) ? track.bin : [track.bin];
        for (const bin of binNames) {
            if (!crates[bin]) crates[bin] = [];
            crates[bin].push(track.id);
        }
    }
    return Object.entries(crates);
}

function buildAllocrateFolder(doc, crateEntries) {
    const folder = doc.createElement("NODE");
    folder.setAttribute("Type", "0");
    folder.setAttribute("Name", "Allocrate");
    folder.setAttribute("Count", String(crateEntries.length));

    for (const [binName, ids] of crateEntries) {
        const playlist = doc.createElement("NODE");
        playlist.setAttribute("Type", "1");
        playlist.setAttribute("Name", binName);
        playlist.setAttribute("KeyType", "0");
        playlist.setAttribute("Entries", String(ids.length));
        for (const id of ids) {
            const trackRef = doc.createElement("TRACK");
            trackRef.setAttribute("Key", id);
            playlist.appendChild(trackRef);
        }
        folder.appendChild(playlist);
    }
    return folder;
}

function findRootNode(doc) {
    for (const node of doc.getElementsByTagName("NODE")) {
        if (node.getAttribute("Type") === "0" && node.getAttribute("Name") === "ROOT") return node;
    }
    return null;
}

// Amend path — keep the user's COLLECTION and PLAYLISTS untouched, swap in our folder.
function buildAmendedDoc(crateEntries) {
    const doc = new DOMParser().parseFromString(originalXML, "application/xml");
    const rootNode = findRootNode(doc);
    if (!rootNode) return null;

    for (const child of Array.from(rootNode.children)) {
        if (child.getAttribute("Name") === "Allocrate") {
            rootNode.removeChild(child);
            break;
        }
    }

    rootNode.appendChild(buildAllocrateFolder(doc, crateEntries));
    return doc;
}

// Fresh path — file import has no source XML, so synthesise a whole document.
function buildFreshDoc(crateEntries) {
    const template =
        '<DJ_PLAYLISTS Version="1.0.0">' +
        '<PRODUCT Name="Allocrate" Version="1.0" Company="Allocrate"/>' +
        '<COLLECTION Entries="0"></COLLECTION>' +
        '<PLAYLISTS><NODE Type="0" Name="ROOT" Count="0"></NODE></PLAYLISTS>' +
        '</DJ_PLAYLISTS>';
    const doc = new DOMParser().parseFromString(template, "application/xml");

    const collection = doc.getElementsByTagName("COLLECTION")[0];
    collection.setAttribute("Entries", String(tracks.length));

    for (const track of tracks) {
        const node = doc.createElement("TRACK");
        node.setAttribute("TrackID", track.id);
        node.setAttribute("Name", track.name || "");
        node.setAttribute("Artist", track.artist || "");
        if (track.bpm)  node.setAttribute("AverageBpm", track.bpm);
        if (track.key)  node.setAttribute("Tonality", track.key);
        if (track.year) node.setAttribute("Year", track.year);
        if (track.location) node.setAttribute("Location", track.location);
        collection.appendChild(node);
    }

    const rootNode = findRootNode(doc);
    rootNode.setAttribute("Count", "1");
    rootNode.appendChild(buildAllocrateFolder(doc, crateEntries));
    return doc;
}

function exportXML() {
    const crateEntries = buildCrates();
    if (crateEntries.length === 0) return;

    const doc = originalXML ? buildAmendedDoc(crateEntries) : buildFreshDoc(crateEntries);
    if (!doc) return;

    // Chrome's serializer keeps the source declaration, Firefox drops it — add one only if missing
    let xmlString = new XMLSerializer().serializeToString(doc);
    if (!xmlString.startsWith('<?xml')) {
        xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
    }

    const blob = new Blob([xmlString], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "allocrate-export.xml";
    a.click();
    URL.revokeObjectURL(url);

    const msg = document.getElementById("export-msg");
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 2000);
}

/* ── Crate export: M3U playlists + symlink script, bundled as one zip ── */

// rekordbox stores "file://localhost/Users/me/Music/x.mp3" — turn it into a real path
function decodeLocation(raw) {
    if (!raw) return '';
    let p = String(raw);
    if (p.startsWith('file://localhost')) p = p.slice('file://localhost'.length);
    else if (p.startsWith('file://')) p = p.slice('file://'.length);
    try { p = decodeURIComponent(p); } catch (err) { /* malformed escape — keep raw */ }
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);   // "/C:/Users/..." -> "C:/Users/..."
    return p;
}

// webkitRelativePath begins with the picked folder's own name; drop it so paths are
// relative to that folder, which is where the generated script expects to run
function relativeInsideRoot(file) {
    const rel = file.webkitRelativePath || '';
    if (!rel) return file.name;
    const parts = rel.split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : rel;
}

function baseName(path) {
    const parts = String(path).split('/');
    return parts[parts.length - 1] || String(path);
}

// single-quote for /bin/sh, escaping any embedded single quote
function shQuote(str) {
    return "'" + String(str).replace(/'/g, "'\\''") + "'";
}

function safeFolderName(name) {
    const cleaned = String(name).replace(/[\/\\]/g, '-').replace(/^\.+/, '').trim();
    return cleaned || 'crate';
}

function uniqueName(used, base) {
    if (!used.has(base)) { used.add(base); return base; }
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext  = dot > 0 ? base.slice(dot) : '';
    let n = 2, candidate;
    do { candidate = stem + ' (' + n + ')' + ext; n++; } while (used.has(candidate));
    used.add(candidate);
    return candidate;
}

function crateGroups() {
    const crates = {};
    for (const track of tracks) {
        if (!track.bin) continue;
        const binNames = Array.isArray(track.bin) ? track.bin : [track.bin];
        for (const bin of binNames) {
            if (!crates[bin]) crates[bin] = [];
            crates[bin].push(track);
        }
    }
    return Object.entries(crates);
}

/* minimal stored-mode zip writer — avoids pulling in a zip dependency */

function crc32(bytes) {
    let table = crc32.table;
    if (!table) {
        table = crc32.table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[i] = c >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(entries) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const data = encoder.encode(entry.text);
        const crc = crc32(data);

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);          // UTF-8 filenames
        lv.setUint16(8, 0, true);               // stored, no compression
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        parts.push(local, data);

        const cd = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(cd.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, (3 << 8) | 20, true);   // made by unix, so the mode below is honoured
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(38, ((entry.exec ? 0o100755 : 0o100644) << 16) >>> 0, true);
        cv.setUint32(42, offset, true);
        cd.set(nameBytes, 46);
        central.push(cd);

        offset += local.length + data.length;
    }

    let centralSize = 0;
    for (const c of central) centralSize += c.length;

    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
}

function buildM3U(binTracks) {
    const lines = ['#EXTM3U'];
    for (const track of binTracks) {
        if (!track.location) continue;
        lines.push('#EXTINF:-1,' + track.artist + ' - ' + track.name);
        lines.push(track.location);
    }
    return lines.join('\n') + '\n';
}

function buildShellScript(groups) {
    const lines = [
        '#!/bin/sh',
        '# Generated by Allocrate.',
        '# Creates one folder per crate, each filled with symlinks to your tracks.',
        '# Nothing is copied or moved — every entry points at your original file.',
        'set -e',
        'ROOT="$(cd "$(dirname "$0")" && pwd)"',
        'OUT="$ROOT/Allocrate"',
        ''
    ];
    let missing = 0;

    for (const [bin, binTracks] of groups) {
        const folder = safeFolderName(bin);
        lines.push('# ' + bin);
        lines.push('mkdir -p "$OUT"/' + shQuote(folder));
        const used = new Set();
        for (const track of binTracks) {
            if (!track.location) { missing++; continue; }
            const link = uniqueName(used, baseName(track.location));
            // relative paths resolve against the script's own directory
            const target = importedFromFiles
                ? '"$ROOT"/' + shQuote(track.location)
                : shQuote(track.location);
            lines.push('ln -sfn ' + target + ' "$OUT"/' + shQuote(folder) + '/' + shQuote(link));
        }
        lines.push('');
    }

    if (missing > 0) lines.push('# ' + missing + ' track(s) had no file path and were skipped');
    lines.push('echo "Done — your crates are in $OUT"');
    return lines.join('\n') + '\n';
}

function buildReadme(groups) {
    const total = groups.reduce((n, g) => n + g[1].length, 0);
    const where = importedFromFiles
        ? 'the folder you imported'
        : 'anywhere (the paths inside are absolute)';
    return [
        'Allocrate — crate export',
        '========================',
        '',
        groups.length + ' crates, ' + total + ' track placements.',
        '',
        'create-folders.sh',
        '  Builds an "Allocrate" folder with one subfolder per crate, filled with',
        '  symlinks to your tracks. No audio is copied, so it uses almost no disk space.',
        '',
        '  Put this script in ' + where + ', then run:',
        '      sh create-folders.sh',
        '',
        '*.m3u8',
        '  One playlist per crate. Drag them into rekordbox, Serato, Traktor, VirtualDJ',
        '  or any player that reads m3u.',
        (importedFromFiles
            ? '  These use relative paths, so keep them in the folder you imported.'
            : '  These use absolute paths, so they work from anywhere.'),
        ''
    ].join('\n');
}

function exportCrates() {
    const groups = crateGroups();
    if (groups.length === 0) return;

    const entries = [
        { name: 'README.txt', text: buildReadme(groups) },
        { name: 'create-folders.sh', text: buildShellScript(groups), exec: true }
    ];

    const usedNames = new Set(entries.map(e => e.name));
    for (const [bin, binTracks] of groups) {
        const fileName = uniqueName(usedNames, safeFolderName(bin) + '.m3u8');
        entries.push({ name: fileName, text: buildM3U(binTracks) });
    }

    const url = URL.createObjectURL(makeZip(entries));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocrate-crates.zip';
    a.click();
    URL.revokeObjectURL(url);

    const msg = document.getElementById('export-msg');
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 2000);
}


function toggleMode() {
    multiMode = !multiMode;
    selectedBins = [];
    document.getElementById('mode-toggle').classList.toggle('active', multiMode);
    document.getElementById('next-btn').hidden = true;
    renderBins();
}

function getActiveBins() {
    const seen = new Set();
    const result = [];
    for (const key of Object.keys(presets)) {
        if (!activePresets.has(key)) continue;
        for (const bin of presets[key]) {
            if (!seen.has(bin.name)) {
                seen.add(bin.name);
                result.push(bin);
            }
        }
    }
    for (const bin of customBins) {
        if (!seen.has(bin.name)) {
            seen.add(bin.name);
            result.push(bin);
        }
    }
    return result;
}

function findBinData(name) {
    for (const binList of Object.values(presets)) {
        const found = binList.find(b => b.name === name);
        if (found) return found;
    }
    return customBins.find(b => b.name === name) || null;
}

function renderPresetPills() {
    const container = document.getElementById('preset-pills');
    container.innerHTML = '';
    for (const key of Object.keys(presets)) {
        const pill = document.createElement('button');
        pill.textContent = key;
        pill.className = 'preset-pill' + (activePresets.has(key) ? ' active' : '');
        pill.onclick = () => togglePreset(key);
        container.appendChild(pill);
    }
}

function togglePreset(key) {
    if (activePresets.has(key)) {
        activePresets.delete(key);
    } else {
        activePresets.add(key);
    }
    renderPresetPills();
    renderBins();
}

function renderBins() {
    const container = document.getElementById("bin-buttons");
    container.innerHTML = "";
    for (const bin of getActiveBins()) {
        const button = document.createElement("button");
        button.textContent = bin.name;
        button.style.setProperty("--bg", bin.bg);
        button.style.setProperty("--sh", bin.shadow);
        button.style.color = bin.text;
        if (multiMode && selectedBins.includes(bin.name)) {
            button.classList.add('bin-selected');
        }
        button.onclick = () => selectBin(bin.name);
        container.appendChild(button);
    }
}

function addBin() {
    const input = document.getElementById("new-bin-name");
    const name = input.value.trim();
    if (name === "") return;

    const colour = nextBinColour();
    customBins.push({
        name: name,
        bg: colour.bg,
        text: colour.text,
        shadow: colour.shadow
    });

    renderBins();
    input.value = "";
}

function dismissLanding() {
    const landing = document.getElementById('landing');
    if (!landing) return;
    landing.classList.add('fade-out');
    setTimeout(() => landing.remove(), 400);
}

function toggleMoreInfo() {
    moreInfoOpen = !moreInfoOpen;
    renderTrackDetails();
}

function renderTrackDetails() {
    const details = document.getElementById('track-details');
    const btn = document.getElementById('more-info-btn');
    const track = currentQueue[currentIndex];
    if (!track) return;

    const rows = [
        ['bpm',  track.bpm],
        ['key',  track.key],
        ['year', track.year]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

    // nothing worth expanding into — hide the toggle entirely
    btn.hidden = rows.length === 0;

    details.innerHTML = '';
    if (!moreInfoOpen || rows.length === 0) {
        details.classList.remove('open');
        btn.textContent = 'more info';
        return;
    }

    for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'detail-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'detail-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'detail-value';
        valueEl.textContent = value;

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        details.appendChild(row);
    }

    details.classList.add('open');
    btn.textContent = 'less info';
}

renderPresetPills();
renderBins();
showCrateView();
showTrack();