// Placeholder for JavaScript logic
document.addEventListener('DOMContentLoaded', () => {
    console.log("ChordFlow script loaded.");

    // Global element references
    const randomizeAllButton = document.getElementById('randomizeAll');
    const keySelector = document.getElementById('keySelector');
    const scaleSelector = document.getElementById('scaleSelector');
    const progressionSelector = document.getElementById('progressionSelector');
    const verticalPianoContainer = document.querySelector('.vertical-piano');
    const pianoRollContainer = document.querySelector('.piano-roll');
    const playPauseButton = document.getElementById('playPause');
    const stopButton = document.getElementById('stop');
    const tempoSlider = document.getElementById('tempo');
    const loopButton = document.getElementById('loop');
    const exportMidiButton = document.getElementById('exportMidi');
    const exportWavButton = document.getElementById('exportWav');

    // --- Constants and Configuration ---
    const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const SCALES = {
        "Major": [0, 2, 4, 5, 7, 9, 11], // W-W-H-W-W-W-H
        "Natural Minor": [0, 2, 3, 5, 7, 8, 10], // W-H-W-W-H-W-W
        "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11], // W-H-W-W-H-WH-H
        "Dorian": [0, 2, 3, 5, 7, 9, 10], // W-H-W-W-W-H-W
        "Mixolydian": [0, 2, 4, 5, 7, 9, 10] // W-W-H-W-W-H-W
    };
    const COMMON_PROGRESSIONS = {
        "I-V-vi-IV (Pop)": [0, 4, 5, 3], // 0-indexed degrees
        "ii-V-I (Jazz)": [1, 4, 0],
        "I-vi-ii-V (Doo-Wop)": [0, 5, 1, 4]
    };
    const NUM_BARS = 4;
    const NOTES_PER_OCTAVE = 12;
    const OCTAVES_ON_PIANO = 3; // Display 3 octaves on the vertical piano
    const LOWEST_PIANO_NOTE_MIDI = 36; // C2

    // --- State Variables ---
    let currentKey = "C"; // Root note name
    let currentScaleName = "Major"; // Key from SCALES object
    let currentProgression = []; // Array of chord objects
    let audioContext;
    let masterGain;
    let tempo = 120;
    let isPlaying = false;
    let loopEnabled = true;
    let playheadPosition = 0; // 0 to NUM_BARS
    let animationFrameId;
    let nextNoteTime = 0.0; // For Web Audio scheduling
    const scheduleAheadTime = 0.1; // seconds
    const lookahead = 25.0; // ms
    let audioInitialized = false;

    // Tone.js piano synth instance will be declared here or in init
    let polyPianoSynth;

    // Global FMSynth options for consistency
    const globalFmSynthOptions = {
        harmonicity: 3.01,
        modulationIndex: 14,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.8 }, // This envelope is for each voice
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.8 },
        volume: -10 // Adjust volume for each voice
    };


    // --- Initialization ---
    async function initializeAudio() {
        if (audioInitialized) return true;

        if (typeof Tone === 'undefined') {
            alert("Audio library (Tone.js) has not loaded. Playback will not work.");
            return false;
        }

        try {
            // Start/resume the audio context on user gesture
            await Tone.start();
            console.log("AudioContext started successfully.");

            audioContext = Tone.context.rawContext;

            masterGain = audioContext.createGain();
            masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
            masterGain.connect(audioContext.destination);

            polyPianoSynth = new Tone.PolySynth(Tone.FMSynth);
            polyPianoSynth.set(globalFmSynthOptions);
            polyPianoSynth.connect(masterGain);

            audioInitialized = true;
            console.log("Audio system initialized.");
            return true;

        } catch (e) {
            alert('Web Audio API or Tone.js initialization failed. Please try again.');
            console.error("Web Audio API / Tone.js init error:", e);
            audioInitialized = false;
            return false;
        }
    }

    function initializeUI() {
        console.log("Initializing ChordFlow UI...");
        populateSelectors();
        setupEventListeners();
        setupVerticalPiano();
        setupPianoRollGrid();

        generateAndDisplayNewProgression(currentKey, currentScaleName, COMMON_PROGRESSIONS[progressionSelector.value]);
        console.log("ChordFlow UI Initialized.");
    }

    function setupEventListeners() {
        randomizeAllButton.addEventListener('click', handleRandomizeAll);
        keySelector.addEventListener('change', handleKeyChange);
        scaleSelector.addEventListener('change', handleScaleChange);
        progressionSelector.addEventListener('change', handleProgressionSelect);
        playPauseButton.addEventListener('click', togglePlayback);
        stopButton.addEventListener('click', stopPlayback);
        tempoSlider.addEventListener('input', (e) => {
            tempo = parseInt(e.target.value, 10);
        });
        loopButton.addEventListener('click', () => {
            loopEnabled = !loopEnabled;
            loopButton.textContent = loopEnabled ? "Loop On" : "Loop Off";
            loopButton.classList.toggle('active', loopEnabled);
        });
        exportMidiButton.addEventListener('click', exportMIDI);
        exportWavButton.addEventListener('click', exportWAV);
    }

    function populateSelectors() {
        NOTES.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            option.textContent = note;
            keySelector.appendChild(option);
        });
        keySelector.value = currentKey;

        Object.keys(SCALES).forEach(scaleName => {
            const option = document.createElement('option');
            option.value = scaleName;
            option.textContent = scaleName;
            scaleSelector.appendChild(option);
        });
        scaleSelector.value = currentScaleName;

        Object.keys(COMMON_PROGRESSIONS).forEach(progName => {
            const option = document.createElement('option');
            option.value = progName;
            option.textContent = progName;
            progressionSelector.appendChild(option);
        });
        progressionSelector.value = "I-V-vi-IV (Pop)";
    }

    function setupVerticalPiano() {
        verticalPianoContainer.innerHTML = ''; // Clear previous keys
        const totalKeys = NOTES_PER_OCTAVE * OCTAVES_ON_PIANO;
        for (let i = 0; i < totalKeys; i++) {
            const key = document.createElement('div');
            const midiNoteNumber = LOWEST_PIANO_NOTE_MIDI + i;
            const noteNameWithOctave = midiToNoteName(midiNoteNumber, true); // Get name like C4, G#3
            const noteNameForStyle = midiToNoteName(midiNoteNumber, false); // Get name like C, G# for class checks
            const isBlackKey = noteNameForStyle.includes('#');

            key.classList.add(isBlackKey ? 'black-key' : 'white-key');
            key.dataset.midi = midiNoteNumber;
            key.dataset.noteName = noteNameWithOctave;

            if (!isBlackKey) {
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('key-name');
                nameSpan.textContent = noteNameForStyle;
                key.appendChild(nameSpan);
            }
            verticalPianoContainer.appendChild(key);
        }
    }

    function setupPianoRollGrid() {
        pianoRollContainer.innerHTML = ''; // Clear previous grid
        for (let i = 0; i < NUM_BARS; i++) {
            const barCell = document.createElement('div');
            barCell.classList.add('piano-roll-bar');
            pianoRollContainer.appendChild(barCell);
        }

        const playhead = document.createElement('div');
        playhead.classList.add('playhead');
        pianoRollContainer.appendChild(playhead);
    }

    // --- Music Theory Engine ---

    function noteToMidi(noteName, octave = 4) {
        const noteBase = NOTES.indexOf(noteName.toUpperCase());
        if (noteBase === -1) return null;
        return noteBase + (octave + 1) * NOTES_PER_OCTAVE;
    }

    function midiToNoteName(midiNumber, includeOctave = true) {
        if (midiNumber === null || midiNumber < 0 || midiNumber > 127) return "";
        const noteIndex = midiNumber % NOTES_PER_OCTAVE;
        const octave = Math.floor(midiNumber / NOTES_PER_OCTAVE) - 1;
        const noteName = NOTES[noteIndex];
        return includeOctave ? `${noteName}${octave}` : noteName;
    }

    function getScaleMidiNotes(rootNote, scaleNameKey, baseOctave = 3) {
        const rootMidi = noteToMidi(rootNote, baseOctave);
        if (rootMidi === null) return [];

        const scaleIntervals = SCALES[scaleNameKey];
        if (!scaleIntervals) return [];

        return scaleIntervals.map(interval => rootMidi + interval);
    }

    function getScaleNoteNames(rootNoteName, scaleNameKey) {
        const rootIndex = NOTES.indexOf(rootNoteName.toUpperCase());
        if (rootIndex === -1) return [];

        const scaleIntervals = SCALES[scaleNameKey];
        if (!scaleIntervals) return [];

        return scaleIntervals.map(interval => NOTES[(rootIndex + interval) % NOTES_PER_OCTAVE]);
    }

    function getTriadQualityByIntervals(semitoneIntervals) {
        const sortedIntervals = [...new Set(semitoneIntervals)].sort((a, b) => a - b);

        if (sortedIntervals.length < 3) return { long: "Unknown", short: "?" };

        const third = sortedIntervals[1];
        const fifth = sortedIntervals[2];

        if (third === 4 && fifth === 7) return { long: "Major", short: "" };
        if (third === 3 && fifth === 7) return { long: "Minor", short: "m" };
        if (third === 3 && fifth === 6) return { long: "Diminished", short: "dim" };
        if (third === 4 && fifth === 8) return { long: "Augmented", short: "aug" };
        
        return { long: "Other", short: "" };
    }

    function buildDiatonicTriad(degree, scaleNoteNamesInOctave, baseOctave = 3) {
        if (degree < 0 || degree >= scaleNoteNamesInOctave.length) return null;

        const rootNoteName = scaleNoteNamesInOctave[degree];
        const thirdNoteName = scaleNoteNamesInOctave[(degree + 2) % scaleNoteNamesInOctave.length];
        const fifthNoteName = scaleNoteNamesInOctave[(degree + 4) % scaleNoteNamesInOctave.length];

        let rootMidi = noteToMidi(rootNoteName, baseOctave);
        let thirdMidi = noteToMidi(thirdNoteName, baseOctave);
        let fifthMidi = noteToMidi(fifthNoteName, baseOctave);

        if (rootMidi === null || thirdMidi === null || fifthMidi === null) {
            console.error("Error converting note names to MIDI for chord building");
            return null;
        }

        if (thirdMidi < rootMidi) thirdMidi += NOTES_PER_OCTAVE;
        if (fifthMidi < thirdMidi) fifthMidi += NOTES_PER_OCTAVE;
        if (fifthMidi < rootMidi) fifthMidi += NOTES_PER_OCTAVE;

        const chordMidiNotes = [rootMidi, thirdMidi, fifthMidi].sort((a,b) => a-b);
        const intervalsFromRoot = chordMidiNotes.map(n => (n - rootMidi + NOTES_PER_OCTAVE * 5) % NOTES_PER_OCTAVE).sort((a,b)=>a-b);
        const quality = getTriadQualityByIntervals(intervalsFromRoot);
        const chordName = rootNoteName + quality.short;

        return {
            name: chordName,
            notes: chordMidiNotes,
            rootNote: rootNoteName,
            degree: degree,
            quality: quality.long
        };
    }

    // --- UI Update Functions ---
    function displayChordProgression() {
        document.querySelectorAll('.note-block').forEach(n => n.remove());
        document.querySelectorAll('.chord-label').forEach(l => l.remove());

        const pianoRollWidth = pianoRollContainer.offsetWidth;
        const barWidth = pianoRollWidth / NUM_BARS;

        let chordLabelRow = document.querySelector('.chord-label-container');
        if (!chordLabelRow) {
            chordLabelRow = document.createElement('div');
            chordLabelRow.classList.add('chord-label-container');
            const mainContent = document.querySelector('.piano-roll-container');
            mainContent.parentNode.insertBefore(chordLabelRow, mainContent);
        }
        chordLabelRow.innerHTML = '';


        currentProgression.forEach((chord, barIndex) => {
            const label = document.createElement('div');
            label.classList.add('chord-label');
            label.textContent = chord.name;
            chordLabelRow.appendChild(label);

            chord.notes.forEach(midiNote => {
                const noteBlock = document.createElement('div');
                noteBlock.classList.add('note-block');

                const keyElement = verticalPianoContainer.querySelector(`[data-midi="${midiNote}"]`);
                if (keyElement) {
                    const keyPosition = keyElement.offsetTop;
                    const keyHeight = keyElement.offsetHeight;

                    noteBlock.style.bottom = `${verticalPianoContainer.offsetHeight - keyPosition - keyHeight}px`;
                    noteBlock.style.height = `${keyHeight -2}px`;
                    noteBlock.style.left = `${barIndex * barWidth + 2}px`;
                    noteBlock.style.width = `${barWidth - 4}px`;

                    pianoRollContainer.appendChild(noteBlock);
                }
            });
        });
    }

    function updatePlayhead(time) {
        if (!isPlaying) return;

        const currentTimeInLoop = audioContext.currentTime - nextNoteTime + (playheadPosition * (60 / tempo));
        const loopDuration = NUM_BARS * (60 / tempo);
        let currentBarFraction = (currentTimeInLoop % loopDuration) / loopDuration;

        if (currentBarFraction < 0) currentBarFraction = 0;

        const playheadElement = document.querySelector('.playhead');
        if (playheadElement) {
            playheadElement.style.left = `${currentBarFraction * 100}%`;
        }

        animationFrameId = requestAnimationFrame(updatePlayhead);
    }


    // --- Event Handlers ---
    async function handleRandomizeAll() {
        const audioReady = await initializeAudio();
        if (!audioReady) {
            alert("Could not initialize audio. Please try again.");
            return;
        }

        console.log("Randomize All clicked");
        const randomKeyIndex = Math.floor(Math.random() * NOTES.length);
        const randomScaleIndex = Math.floor(Math.random() * Object.keys(SCALES).length);
        currentKey = NOTES[randomKeyIndex];
        currentScaleName = Object.keys(SCALES)[randomScaleIndex];

        keySelector.value = currentKey;
        scaleSelector.value = currentScaleName;

        const progressionNames = Object.keys(COMMON_PROGRESSIONS);
        const randomProgName = progressionNames[Math.floor(Math.random() * progressionNames.length)];
        progressionSelector.value = randomProgName;
        const romanNumeralProgression = COMMON_PROGRESSIONS[randomProgName];

        generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression);

        if (isPlaying) {
            stopPlayback();
        }
        togglePlayback();
    }

    function handleKeyChange(event) {
        currentKey = event.target.value;
        console.log("Key changed to:", currentKey);
        regenerateCurrentProgression();
    }

    function handleScaleChange(event) {
        currentScaleName = event.target.value;
        console.log("Scale changed to:", currentScaleName);
        regenerateCurrentProgression();
    }

    function handleProgressionSelect(event) {
        const selectedProgName = event.target.value;
        const romanNumeralProgression = COMMON_PROGRESSIONS[selectedProgName];
        console.log("Progression selected:", selectedProgName);
        generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression);
    }

    function regenerateCurrentProgression() {
        const selectedProgName = progressionSelector.value;
        const romanNumeralProgression = COMMON_PROGRESSIONS[selectedProgName];
        if (romanNumeralProgression) {
            generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression);
        } else {
            console.warn("No common progression selected for regeneration. Using first available.");
            const firstProgKey = Object.keys(COMMON_PROGRESSIONS)[0];
            generateAndDisplayNewProgression(currentKey, currentScaleName, COMMON_PROGRESSIONS[firstProgKey]);
        }
    }

    function generateAndDisplayNewProgression(rootNoteName, scaleNameKey, romanNumeralDegrees) {
        const scaleNoteNamesCurrentOctave = getScaleNoteNames(rootNoteName, scaleNameKey);
        if (scaleNoteNamesCurrentOctave.length === 0) {
            console.error("Could not generate scale notes for", rootNoteName, scaleNameKey);
            currentProgression = [];
            displayChordProgression();
            return;
        }

        let baseOctaveForVoicing = 3;

        currentProgression = romanNumeralDegrees.map((degree, index) => {
            if (index > 0 && currentProgression[index-1] && currentProgression[index-1].notes.length > 0) {
                const previousChordAvgMidi = currentProgression[index-1].notes.reduce((s,n)=>s+n,0) / currentProgression[index-1].notes.length;
                const currentRootMidiGuess = noteToMidi(scaleNoteNamesCurrentOctave[degree], baseOctaveForVoicing);
                if (currentRootMidiGuess < previousChordAvgMidi - 6) {
                    baseOctaveForVoicing++;
                } else if (currentRootMidiGuess > previousChordAvgMidi + 6) {
                    baseOctaveForVoicing--;
                }
                baseOctaveForVoicing = Math.max(2, Math.min(4, baseOctaveForVoicing));
            }
            return buildDiatonicTriad(degree, scaleNoteNamesCurrentOctave, baseOctaveForVoicing);
        }).filter(chord => chord !== null);

        if (currentProgression.length > 0) {
            let originalGeneratedChords = [...currentProgression];
            while (currentProgression.length < NUM_BARS && originalGeneratedChords.length > 0) {
                currentProgression.push(...originalGeneratedChords.slice(0, NUM_BARS - currentProgression.length));
            }
        }
         if (currentProgression.length > NUM_BARS) {
            currentProgression = currentProgression.slice(0, NUM_BARS);
        }

        if(currentProgression.some(c => c === null || typeof c === 'undefined')){
            console.error("Error: Null or undefined chord found in progression", currentProgression);
            currentProgression = currentProgression.filter(c => c !== null && typeof c !== 'undefined');
        }


        console.log("New Progression:", currentProgression.map(c=>c ? c.name : "Error").join(" - "));
        displayChordProgression();
    }

    // --- Playback Functions ---
    let schedulerTimerID;

    async function togglePlayback() {
        const audioReady = await initializeAudio();
        if (!audioReady) {
            alert("Could not initialize audio. Please try again.");
            return;
        }

        isPlaying = !isPlaying;
        if (isPlaying) {
            playPauseButton.textContent = "Pause";
            playPauseButton.classList.add('playing');
            playPauseButton.classList.remove('stopped');
            if (playheadPosition >= NUM_BARS) {
                playheadPosition = 0;
            }
            nextNoteTime = audioContext.currentTime;
            scheduler();
            animationFrameId = requestAnimationFrame(updatePlayhead);
        } else {
            playPauseButton.textContent = "Play";
            playPauseButton.classList.remove('playing');
            clearTimeout(schedulerTimerID);
            cancelAnimationFrame(animationFrameId);
             masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
             masterGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);
             setTimeout(() => {
                 masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
             }, 150);
        }
    }

    function stopPlayback() {
        isPlaying = false;
        playPauseButton.textContent = "Play";
        playPauseButton.classList.remove('playing');
        playPauseButton.classList.add('stopped');
        clearTimeout(schedulerTimerID);
        cancelAnimationFrame(animationFrameId);
        playheadPosition = 0;
        nextNoteTime = 0;
        const playheadElement = document.querySelector('.playhead');
        if (playheadElement) {
            playheadElement.style.left = `0%`;
        }
        if (audioInitialized) {
            masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.05);
            setTimeout(() => {
                 masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
            }, 100);
        }

        document.querySelectorAll('.highlighted-key').forEach(key => key.classList.remove('highlighted-key'));
    }

    function scheduler() {
        while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            scheduleNotesForBar(playheadPosition, nextNoteTime);
            advancePlayhead();
        }
        schedulerTimerID = setTimeout(scheduler, lookahead);
    }

    function advancePlayhead() {
        const secondsPerBeat = 60.0 / tempo;
        const secondsPerBar = secondsPerBeat * 4;

        nextNoteTime += secondsPerBar;

        playheadPosition++;
        if (playheadPosition >= NUM_BARS) {
            playheadPosition = 0;
            if (!loopEnabled) {
                isPlaying = false;
                playPauseButton.textContent = "Play";
                clearTimeout(schedulerTimerID);
                cancelAnimationFrame(animationFrameId);
                return;
            }
        }
    }

    function scheduleNotesForBar(barIndex, time) {
        if (barIndex >= currentProgression.length) return;

        const chord = currentProgression[barIndex];
        const secondsPerBeat = 60.0 / tempo;
        const noteDuration = secondsPerBeat * 4;

        chord.notes.forEach(midiNote => {
            playPianoNote(midiNote, time, noteDuration);
            highlightPianoKey(midiNote, true, noteDuration * 1000);
        });
    }

    function playPianoNote(midiNote, startTime, durationSeconds) {
        if (!polyPianoSynth || typeof Tone === 'undefined' || !audioInitialized) {
            console.warn("Audio system not ready. Cannot play note.");
            return;
        }
        const noteName = Tone.Frequency(midiNote, "midi").toNote();
        polyPianoSynth.triggerAttackRelease(noteName, durationSeconds, startTime);
    }

    function highlightPianoKey(midiNote, turnOn, durationMs) {
        const keyElement = verticalPianoContainer.querySelector(`[data-midi="${midiNote}"]`);
        if (keyElement) {
            if (turnOn) {
                keyElement.classList.add('highlighted-key');
                if (durationMs) {
                    setTimeout(() => {
                        keyElement.classList.remove('highlighted-key');
                    }, durationMs);
                }
            } else {
                keyElement.classList.remove('highlighted-key');
            }
        }
    }


    // --- Export Functions ---
    function exportMIDI() {
        if (!currentProgression || currentProgression.length === 0) {
            alert("No progression to export!");
            return;
        }

        if (typeof MidiWriter === 'undefined') {
            alert("MIDI Writer library not loaded. Cannot export MIDI.");
            console.error("MidiWriter is not defined.");
            return;
        }

        const track = new MidiWriter.Track();
        track.setTempo(tempo);
        const noteDuration = '1';

        currentProgression.forEach(chord => {
            if (chord && chord.notes && chord.notes.length > 0) {
                const chordEvent = new MidiWriter.NoteEvent({
                    pitch: chord.notes,
                    duration: noteDuration,
                    sequential: false
                });
                track.addEvent(chordEvent);
            } else {
                const restEvent = new MidiWriter.NoteEvent({
                    pitch: [0],
                    duration: noteDuration,
                    velocity: 0
                });
                track.addEvent(restEvent);
            }
        });

        const writer = new MidiWriter.Writer([track]);
        const midiDataUri = writer.dataUri();

        const a = document.createElement('a');
        a.href = midiDataUri;
        a.download = "ChordFlow_Progression.mid";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        console.log("MIDI Exported");
    }

// --- WAV Export Helper Functions ---
function audioBufferToWav(buffer, opt_params = {}) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = opt_params.float32 ? 3 : 1;
    const bitDepth = format === 3 ? 32 : 16;

    let result_data;
    if (numChannels === 2) {
        result_data = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result_data = buffer.getChannelData(0);
    }

    return encodeWAV(result_data, format, sampleRate, numChannels, bitDepth);
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
    const blockAlign = (numChannels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * (bitDepth / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeStringView(view_obj, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view_obj.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeStringView(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStringView(view, 8, 'WAVE');
    writeStringView(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeStringView(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    if (format === 1) { // 16-bit PCM
        for (let i = 0; i < samples.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    } else { // 32-bit float
        for (let i = 0; i < samples.length; i++, offset += 4) {
            view.setFloat32(offset, samples[i], true);
        }
    }
    return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}
// --- End WAV Export Helper Functions ---

async function exportWAV() {
    if (!currentProgression || currentProgression.length === 0) {
        alert("No progression to export!");
        return;
    }
    if (typeof Tone === 'undefined' || !polyPianoSynth) {
        alert("Tone.js or synth not initialized. Cannot export WAV.");
        console.error("Tone.js or polyPianoSynth not available for WAV export.");
        return;
    }

    if (Tone.context.state !== 'running') {
        await Tone.start().catch(e => {
            console.error("Tone.start() failed before WAV export:", e);
            alert("Audio context could not be started. Please interact with the page first.");
            return;
        });
    }

    const originalIsPlaying = isPlaying;
    if (isPlaying) {
        stopButton.click();
    }

    const secondsPerBeat = 60.0 / tempo;
    const beatsPerBar = 4;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    const totalDurationSeconds = NUM_BARS * secondsPerBar;

    try {
        console.log("Starting Tone.Offline rendering for WAV export...");

        const renderedBuffer = await Tone.Offline(async (offlineTransport) => {
            const offlinePolySynth = new Tone.PolySynth(Tone.FMSynth);
            offlinePolySynth.set(globalFmSynthOptions);
            offlinePolySynth.toDestination();

            let currentTime = 0;
            currentProgression.forEach(chord => {
                if (chord && chord.notes && chord.notes.length > 0) {
                    const frequencies = chord.notes.map(midi => Tone.Frequency(midi, "midi").toNote());
                    offlinePolySynth.triggerAttackRelease(frequencies, secondsPerBar, currentTime);
                }
                currentTime += secondsPerBar;
            });
        }, totalDurationSeconds);

        const nativeAudioBuffer = renderedBuffer.get();
        if (!nativeAudioBuffer) {
            throw new Error("Tone.Offline did not produce a valid AudioBuffer.");
        }

        const wavBlob = audioBufferToWav(nativeAudioBuffer);

        const a = document.createElement('a');
        a.href = URL.createObjectURL(wavBlob);
        a.download = "ChordFlow_Progression_Tone.wav";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        console.log("WAV Exported using Tone.Offline");

    } catch (error) {
        console.error("Error rendering or exporting WAV with Tone.Offline:", error);
        alert("Failed to export WAV: " + error.message);
    } finally {
        if (originalIsPlaying) {
             console.log("Playback was stopped for WAV export. Please press Play to resume if desired.");
        }
    }
    }

    // --- Start the application ---
    initializeUI();

}); // End of the single, main DOMContentLoaded listener


// Polyfill for requestAnimationFrame and cancelAnimationFrame
(function() {
    let lastTime = 0;
    const vendors = ['ms', 'moz', 'webkit', 'o'];
    for(let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            const currTime = new Date().getTime();
            const timeToCall = Math.max(0, 16 - (currTime - lastTime));
            const id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());