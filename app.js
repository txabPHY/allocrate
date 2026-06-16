let tracks = [{name: "the cure", artist: "olivia rodrigo"},
                {name: "good 4 u", artist: "olivia rodrigo"},
                {name: "sour", artist: "olivia rodrigo"},
                {name: "drivers license", artist: "olivia rodrigo"},
                {name: "Le Tigre", artist: "Overmono"}
                ]

const bins = [
    { name: "peak time",  bg: "linear-gradient(135deg, #FF5BA6, #E3008C)", text: "#fff",    shadow: "#A8006A" },
    { name: "euphoric",   bg: "linear-gradient(135deg, #FF8A9B, #F43F5E)", text: "#fff",    shadow: "#BE123C" },
    { name: "warmup",     bg: "linear-gradient(135deg, #FFC83D, #FF8C42)", text: "#3d1e00", shadow: "#C2590B" },
    { name: "rolling",    bg: "linear-gradient(135deg, #3FDBC6, #00B7C3)", text: "#003033", shadow: "#00777F" },
    { name: "deep",       bg: "linear-gradient(135deg, #6EE7B7, #10B981)", text: "#064e3b", shadow: "#047857" },
    { name: "late night", bg: "linear-gradient(135deg, #5BA0FF, #2E6BFF)", text: "#fff",    shadow: "#1A47B5" },
    { name: "groovy",     bg: "linear-gradient(135deg, #B98AFF, #7C3AED)", text: "#fff",    shadow: "#5B21B6" },
    { name: "dark",       bg: "linear-gradient(135deg, #6B7280, #374151)", text: "#fff",    shadow: "#1F2937" }
];

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

    const bg = `linear-gradient(135deg, hsl(${hue}, 80%, 62%), hsl(${(hue + 18) % 360}, 85%, 50%))`;
    const shadow = `hsl(${hue}, 85%, 38%)`;

    const [r, g, b] = hslToRgb(hue, 82, 56);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const text = brightness > 150 ? "#1a1a1a" : "#fff";

    return { bg, text, shadow };
}

for (let track of tracks) {
    track.bin = null;
}

let skippedTracks = [];
let currentQueue = tracks;
let currentIndex = 0;


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
        const parsed = parseRekordboxXML(reader.result);
        if (parsed.length === 0) {
            alert("No tracks found. Is this a rekordbox collection XML?");
            return;
        }
        loadTracks(parsed);
    };
    reader.readAsText(file);
}

function loadTracks(newTracks) {
    tracks = newTracks;
    currentQueue = tracks;
    currentIndex = 0;
    skippedTracks = [];
    document.getElementById("finished-message").textContent = "";
    showCrateView();
    showTrack();
}

function showTrack() {
    const card = document.querySelector('.track-card');
    card.classList.remove('animate');
    void card.offsetWidth;
    card.classList.add('animate');

    const track = currentQueue[currentIndex];
    document.getElementById('track-name').textContent = track.name;
    document.getElementById('track-artist').textContent = track.artist;

    document.getElementById('track-counter').textContent = (currentIndex + 1) + ' / ' + currentQueue.length;
    document.getElementById('progress-fill').style.width = (currentIndex / currentQueue.length * 100) + '%';
}

function selectBin(bin_name) {
    const track = currentQueue[currentIndex];
    track.bin = bin_name;
    showCrateView();
    currentIndex = currentIndex + 1;
    if (currentIndex >= currentQueue.length) {
        if (skippedTracks.length > 0) {
            goToSkipped();
            return;
        }
        document.getElementById("finished-message").innerText = "Finished! You have sorted all the tracks.";
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('track-counter').textContent = currentQueue.length + ' / ' + currentQueue.length;
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
        document.getElementById("finished-message").innerText = "Finished! You have sorted all the tracks.";
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('track-counter').textContent = currentQueue.length + ' / ' + currentQueue.length;
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
        return;
    }
    document.getElementById("finished-message").innerText = "";
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
        if (track.bin) {
            if (!crates[track.bin]) {
                crates[track.bin] = [];
            }
            crates[track.bin].push(track);
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
        const binData = bins.find(b => b.name === bin);
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
}

function endSession() {
    document.getElementById("finished-message").innerText = "Session ended. Here are your sorted tracks:";
    showCrateView();
}

function renderBins() {
    const container = document.getElementById("bin-buttons");
    container.innerHTML = "";
    for (const bin of bins) {
        const button = document.createElement("button");
        button.textContent = bin.name;
        button.style.setProperty("--bg", bin.bg);
        button.style.setProperty("--sh", bin.shadow);
        button.style.color = bin.text;
        button.onclick = () => selectBin(bin.name);
        container.appendChild(button);
    }
}

function addBin() {
    const input = document.getElementById("new-bin-name");
    const name = input.value.trim();
    if (name === "") return;

    const colour = nextBinColour();
    bins.push({
        name: name,
        bg: colour.bg,
        text: colour.text,
        shadow: colour.shadow
    });

    renderBins();
    input.value = "";
}

renderBins();
showCrateView();
showTrack();