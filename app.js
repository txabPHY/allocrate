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
    document.getElementById('export-btn').disabled = !originalXML || !hasBin;
}

function exportXML() {
    if (!originalXML) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(originalXML, "application/xml");

    const allNodes = doc.getElementsByTagName("NODE");
    let rootNode = null;
    for (const node of allNodes) {
        if (node.getAttribute("Type") === "0" && node.getAttribute("Name") === "ROOT") {
            rootNode = node;
            break;
        }
    }
    if (!rootNode) return;

    for (const child of Array.from(rootNode.children)) {
        if (child.getAttribute("Name") === "Allocrate") {
            rootNode.removeChild(child);
            break;
        }
    }

    const crates = {};
    for (const track of tracks) {
        if (!track.bin || !track.id) continue;
        const binNames = Array.isArray(track.bin) ? track.bin : [track.bin];
        for (const bin of binNames) {
            if (!crates[bin]) crates[bin] = [];
            crates[bin].push(track.id);
        }
    }

    const crateEntries = Object.entries(crates);
    if (crateEntries.length === 0) return;

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

    rootNode.appendChild(folder);

    const xmlString = new XMLSerializer().serializeToString(doc);
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

function openHelp() {
    console.log('help — coming soon');
}

renderPresetPills();
renderBins();
showCrateView();
showTrack();