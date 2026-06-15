const tracks = [{name: "the cure", artist: "olivia rodrigo"},
                {name: "good 4 u", artist: "olivia rodrigo"},
                {name: "sour", artist: "olivia rodrigo"},
                {name: "drivers license", artist: "olivia rodrigo"},
                {name: "Le Tigre", artist: "Overmono"}
                ]

for (let track of tracks) {
    track.bin = null;
}

let skippedTracks = [];
let currentQueue = tracks;
let currentIndex = 0;

function showTrack() {
    const track = currentQueue[currentIndex];
    document.getElementById('track-name').textContent = track.name;
    document.getElementById('track-artist').textContent = track.artist;
}

function selectBin(bin_name) {
    const track = currentQueue[currentIndex];
    track.bin = bin_name;
    currentIndex = currentIndex + 1;
    if (currentIndex >= currentQueue.length) {
        if (skippedTracks.length > 0) {
            goToSkipped();
            return;
        }
        document.getElementById("finished-message").innerText = "Finished! You have sorted all the tracks.";
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
    const track = currentQueue[currentIndex];
    track.bin = null;
    showTrack();
}

function showCrateView() {
    let crates = {};
    for (let track of tracks) {
        if (track.bin) {
            if (!crates[track.bin]) {
                crates[track.bin] = [];
            }
            crates[track.bin].push(track);
        }
    }
    console.log(crates);
}

showTrack();