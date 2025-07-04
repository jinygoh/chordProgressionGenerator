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
    async function init() {
        console.log("Initializing ChordFlow...");

        // Initialize base Web Audio API AudioContext (Tone.js will use its own or can adopt this)
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioContext.createGain();
            masterGain.gain.setValueAtTime(0.5, audioContext.currentTime); // Global volume control
            masterGain.connect(audioContext.destination);

            if (typeof Tone !== 'undefined') {
                polyPianoSynth = new Tone.PolySynth(Tone.FMSynth); // Pass only the synth type
                // PolySynth has its own envelope that can affect all voices,
                // or each voice (FMSynth) has its own. We are configuring voice envelopes.
                // To set options for the voices (FMSynth instances):
                polyPianoSynth.set(globalFmSynthOptions);

                // If you want a master envelope for the PolySynth itself (e.g. for overall chord attack/release)
                // polyPianoSynth.envelope.attack = 0.02; // Example

                polyPianoSynth.connect(masterGain);

            } else {
                console.error("Tone.js not loaded!");
                alert("Audio library (Tone.js) not loaded. Playback will not work.");
            }

        } catch (e) {
            alert('Web Audio API or Tone.js initialization failed.');
            console.error("Web Audio API / Tone.js init error:", e);
        }

        populateSelectors();
        setupVerticalPiano();
        setupPianoRollGrid();
        //generateInitialProgression(); // Generate something on load
        //updateUI();

        // Event Listeners
    } // End of init function

    function populateSelectors() {
        randomizeAllButton.addEventListener('click', handleRandomizeAll);
        keySelector.addEventListener('change', handleKeyChange);
        scaleSelector.addEventListener('change', handleScaleChange);
        progressionSelector.addEventListener('change', handleProgressionSelect);
        playPauseButton.addEventListener('click', togglePlayback);
        stopButton.addEventListener('click', stopPlayback);
        tempoSlider.addEventListener('input', (e) => {
            tempo = parseInt(e.target.value, 10);
            // Update tempo display if needed
        });
        loopButton.addEventListener('click', () => {
            loopEnabled = !loopEnabled;
            loopButton.textContent = loopEnabled ? "Loop On" : "Loop Off";
            if (loopEnabled) {
                loopButton.classList.add('active');
            } else {
                loopButton.classList.remove('active');
            }
        });
        exportMidiButton.addEventListener('click', exportMIDI);
        exportWavButton.addEventListener('click', exportWAV);

        // Initialize Web Audio -- MOVED earlier in init() before loadAudioSamples()

        console.log("ChordFlow initialized.");
        // Initialize with default key, scale, and selected progression
        generateAndDisplayNewProgression(currentKey, currentScaleName, COMMON_PROGRESSIONS[progressionSelector.value]);
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
            option.value = scaleName; // This is the key for SCALES object
            option.textContent = scaleName; // Display name
            scaleSelector.appendChild(option);
        });
        scaleSelector.value = currentScaleName;

        Object.keys(COMMON_PROGRESSIONS).forEach(progName => {
            const option = document.createElement('option');
            option.value = progName;
            option.textContent = progName;
            progressionSelector.appendChild(option);
        });
        progressionSelector.value = "I-V-vi-IV (Pop)"; // Default
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
        key.dataset.noteName = noteNameWithOctave; // Store full name with octave for potential debugging or advanced features

            // Add note name display for white keys
            if (!isBlackKey) {
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('key-name');
            // Display only the note letter (e.g., "C", "D") on the key
            nameSpan.textContent = noteNameForStyle;
                key.appendChild(nameSpan);
            }
            verticalPianoContainer.appendChild(key);
        }
    }

    function setupPianoRollGrid() {
        pianoRollContainer.innerHTML = ''; // Clear previous grid
        // Create placeholder cells for bars - notes will be drawn over these
        for (let i = 0; i < NUM_BARS; i++) {
            const barCell = document.createElement('div');
            barCell.classList.add('piano-roll-bar');
            // barCell.style.borderRight = "1px solid #444"; // Bar lines
            pianoRollContainer.appendChild(barCell);
        }

        // Add playhead
        const playhead = document.createElement('div');
        playhead.classList.add('playhead');
        pianoRollContainer.appendChild(playhead);
    }

    // --- Music Theory Engine ---

    /**
     * Converts a note name (e.g., "C#") and octave to a MIDI note number.
     * @param {string} noteName - The name of the note (e.g., "C", "F#").
     * @param {number} octave - The octave number (e.g., 4 for middle C).
     * @returns {number|null} The MIDI note number, or null if noteName is invalid.
     */
    function noteToMidi(noteName, octave = 4) {
        const noteBase = NOTES.indexOf(noteName.toUpperCase());
        if (noteBase === -1) return null;
        // MIDI standard: C4 is 60. Octave 0 for NOTES[0] (C) is MIDI note 12.
        return noteBase + (octave + 1) * NOTES_PER_OCTAVE;
    }

    /**
     * Converts a MIDI note number to its note name and octave.
     * @param {number} midiNumber - The MIDI note number.
     * @param {boolean} includeOctave - Whether to include the octave in the output string.
     * @returns {string} The note name (e.g., "C4", "F#3").
     */
    function midiToNoteName(midiNumber, includeOctave = true) {
        if (midiNumber === null || midiNumber < 0 || midiNumber > 127) return "";
        const noteIndex = midiNumber % NOTES_PER_OCTAVE;
        const octave = Math.floor(midiNumber / NOTES_PER_OCTAVE) - 1; // C4 is middle C, MIDI 60. Octave is 4.
        const noteName = NOTES[noteIndex];
        return includeOctave ? `${noteName}${octave}` : noteName;
    }

    /**
     * Gets the absolute MIDI numbers for notes in a given scale.
     * @param {string} rootNote - The root note of the scale (e.g., "C", "G#").
     * @param {string} scaleName - The name of the scale (e.g., "Major", "Harmonic Minor").
     * @param {number} baseOctave - The starting octave for the scale's root note.
     * @returns {number[]} An array of MIDI note numbers for one octave of the scale.
     */
    function getScaleMidiNotes(rootNote, scaleNameKey, baseOctave = 3) { // param renamed to scaleNameKey
        const rootMidi = noteToMidi(rootNote, baseOctave);
        if (rootMidi === null) return [];

        const scaleIntervals = SCALES[scaleNameKey]; // Used scaleNameKey
        if (!scaleIntervals) return [];

        return scaleIntervals.map(interval => rootMidi + interval);
    }

    /**
     * Gets the note names for a given scale.
     * @param {string} rootNoteName - The root note of the scale (e.g., "C").
     * @param {string} scaleNameKey - The key for the scale in the SCALES object (e.g., "Major").
     * @returns {string[]} An array of note names (e.g., ["C", "D", "E", "F", "G", "A", "B"] for C Major).
     */
    function getScaleNoteNames(rootNoteName, scaleNameKey) { // Consistently use scaleNameKey
        const rootIndex = NOTES.indexOf(rootNoteName.toUpperCase());
        if (rootIndex === -1) return [];

        const scaleIntervals = SCALES[scaleNameKey];
        if (!scaleIntervals) return [];

        return scaleIntervals.map(interval => NOTES[(rootIndex + interval) % NOTES_PER_OCTAVE]);
    }


    /**
     * Determines the quality of a chord based on its intervals.
     * This is a simplified version for triads.
     * @param {number[]} semitoneIntervals - Array of intervals from the root (e.g., [0, 4, 7] for Major).
     * @returns {object} Object with 'long' and 'short' names for the quality.
     */
    function getTriadQualityByIntervals(semitoneIntervals) {
        // Ensure intervals are sorted and normalized (e.g., [0, 3, 6] for diminished)
        const sortedIntervals = [...new Set(semitoneIntervals)].sort((a, b) => a - b); // Unique, sorted intervals from root (0)

        if (sortedIntervals.length < 3) return { long: "Unknown", short: "?" }; // Not enough notes for a triad

        const third = sortedIntervals[1];
        const fifth = sortedIntervals[2];

        if (third === 4 && fifth === 7) return { long: "Major", short: "" };
        if (third === 3 && fifth === 7) return { long: "Minor", short: "m" };
        if (third === 3 && fifth === 6) return { long: "Diminished", short: "dim" };
        if (third === 4 && fifth === 8) return { long: "Augmented", short: "aug" };
        // Add recognition for sus chords if needed, e.g. [0,5,7] for sus4 or [0,2,7] for sus2
        // For now, focusing on standard triads.

        return { long: "Other", short: "" }; // Other non-standard triad type
    }


    /**
     * Builds a diatonic chord (currently triad) on a specific degree of a scale.
     * @param {number} degree - The scale degree (0-indexed, e.g., 0 for I, 1 for ii).
     * @param {string[]} scaleNoteNamesInOctave - Array of note names in the current scale (e.g., ["C", "D", "E"...]).
     * @param {number} baseOctave - The octave for the root of the chord.
     * @returns {object|null} A chord object { name, notes (MIDI), rootNote, degree, quality } or null.
     */
    function buildDiatonicTriad(degree, scaleNoteNamesInOctave, baseOctave = 3) {
        if (degree < 0 || degree >= scaleNoteNamesInOctave.length) return null;

        const rootNoteName = scaleNoteNamesInOctave[degree];

        // Get notes for the triad by stacking thirds from the scale
        const thirdNoteName = scaleNoteNamesInOctave[(degree + 2) % scaleNoteNamesInOctave.length];
        const fifthNoteName = scaleNoteNamesInOctave[(degree + 4) % scaleNoteNamesInOctave.length];

        // Simplified octave adjustment for voice leading:
        // Try to keep notes within one octave span if possible, or close by.
        let rootMidi = noteToMidi(rootNoteName, baseOctave);
        let thirdMidi = noteToMidi(thirdNoteName, baseOctave);
        let fifthMidi = noteToMidi(fifthNoteName, baseOctave);

        if (rootMidi === null || thirdMidi === null || fifthMidi === null) {
            console.error("Error converting note names to MIDI for chord building");
            return null;
        }

        // Adjust octaves for smoother voicing (basic version)
        // If a note is more than a tritone lower than the root, bump it up an octave.
        // If a note is more than an octave higher, consider bumping down (more complex).
        // This version prioritizes keeping notes above or near the root's octave.

        if (thirdMidi < rootMidi - 6) thirdMidi += NOTES_PER_OCTAVE; // If third is too low, raise octave
        else if (thirdMidi > rootMidi + NOTES_PER_OCTAVE ) thirdMidi -= NOTES_PER_OCTAVE; // If too high, lower

        if (fifthMidi < rootMidi - 6) fifthMidi += NOTES_PER_OCTAVE;
        else if (fifthMidi > rootMidi + NOTES_PER_OCTAVE) fifthMidi -= NOTES_PER_OCTAVE;

        // Further adjustment: ensure notes are ascending from root (or close)
        if (thirdMidi < rootMidi) thirdMidi += NOTES_PER_OCTAVE;
        if (fifthMidi < thirdMidi) fifthMidi += NOTES_PER_OCTAVE; // Ensure 5th is above 3rd
        if (fifthMidi < rootMidi) fifthMidi += NOTES_PER_OCTAVE; // Ensure 5th is above root (again, if prev adjustment wasn't enough)


        const chordMidiNotes = [rootMidi, thirdMidi, fifthMidi].sort((a,b) => a-b); // Store sorted

        // Determine chord quality based on intervals from the true root
        const intervalsFromRoot = chordMidiNotes.map(n => (n - rootMidi + NOTES_PER_OCTAVE * 5) % NOTES_PER_OCTAVE).sort((a,b)=>a-b);

        const quality = getTriadQualityByIntervals(intervalsFromRoot);

        const chordName = rootNoteName + quality.short;

        return {
            name: chordName,
            notes: chordMidiNotes, // MIDI numbers, now potentially voiced
            rootNote: rootNoteName,
            degree: degree,
            quality: quality.long // e.g. "Major", "Minor"
        };
    }


    // --- UI Update Functions ---
    function displayChordProgression() {
        // Clear existing notes and labels
        document.querySelectorAll('.note-block').forEach(n => n.remove());
        document.querySelectorAll('.chord-label').forEach(l => l.remove());

        const pianoRollWidth = pianoRollContainer.offsetWidth;
        const barWidth = pianoRollWidth / NUM_BARS;

        // Create a container for chord labels if it doesn't exist or reuse existing one
        let chordLabelRow = document.querySelector('.chord-label-container');
        if (!chordLabelRow) {
            chordLabelRow = document.createElement('div');
            chordLabelRow.classList.add('chord-label-container');
            // Insert it before the piano-roll-container
            const mainContent = document.querySelector('.piano-roll-container');
            mainContent.parentNode.insertBefore(chordLabelRow, mainContent);
        }
        chordLabelRow.innerHTML = ''; // Clear previous labels


        currentProgression.forEach((chord, barIndex) => {
            // Display chord label
            const label = document.createElement('div');
            label.classList.add('chord-label');
            label.textContent = chord.name;
            chordLabelRow.appendChild(label);

            // Display notes in piano roll
            chord.notes.forEach(midiNote => {
                const noteBlock = document.createElement('div');
                noteBlock.classList.add('note-block');

                // Position calculation (very basic)
                const keyElement = verticalPianoContainer.querySelector(`[data-midi="${midiNote}"]`);
                if (keyElement) {
                    const keyPosition = keyElement.offsetTop; // From top of vertical piano
                    const keyHeight = keyElement.offsetHeight;

                    noteBlock.style.bottom = `${verticalPianoContainer.offsetHeight - keyPosition - keyHeight}px`; // Position from bottom of piano roll
                    noteBlock.style.height = `${keyHeight -2}px`; // Slightly less than key height for visual separation
                    noteBlock.style.left = `${barIndex * barWidth + 2}px`; // +2 for slight padding
                    noteBlock.style.width = `${barWidth - 4}px`; // -4 for padding

                    pianoRollContainer.appendChild(noteBlock);
                }
            });
        });
    }

    function updatePlayhead(time) {
        if (!isPlaying) return;

        const currentTimeInLoop = audioContext.currentTime - nextNoteTime + (playheadPosition * (60 / tempo)); // Approximate current time in loop
        const loopDuration = NUM_BARS * (60 / tempo);
        let currentBarFraction = (currentTimeInLoop % loopDuration) / loopDuration;

        if (currentBarFraction < 0) currentBarFraction = 0; // Clamp at start

        const playheadElement = document.querySelector('.playhead');
        if (playheadElement) {
            playheadElement.style.left = `${currentBarFraction * 100}%`;
        }

        animationFrameId = requestAnimationFrame(updatePlayhead);
    }


    // --- Event Handlers ---
    async function handleRandomizeAll() { // Made async
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            try {
                await Tone.start();
                console.log("Tone.js AudioContext started by Randomize All.");
            } catch (e) {
                console.error("Tone.start() failed in handleRandomizeAll:", e);
                alert("Audio context could not be started by Randomize All. Please click again or refresh.");
                return; // Prevent further action if audio can't start
            }
        }

        console.log("Randomize All clicked");
        // 1. Select random key and scale
        const randomKeyIndex = Math.floor(Math.random() * NOTES.length);
        const randomScaleIndex = Math.floor(Math.random() * Object.keys(SCALES).length);
        currentKey = NOTES[randomKeyIndex];
        currentScaleName = Object.keys(SCALES)[randomScaleIndex]; // Update global state variable

        keySelector.value = currentKey;
        scaleSelector.value = currentScaleName; // Update selector

        // 2. Generate new progression (for now, use a common one randomly or make a simple one)
        const progressionNames = Object.keys(COMMON_PROGRESSIONS);
        const randomProgName = progressionNames[Math.floor(Math.random() * progressionNames.length)];
        progressionSelector.value = randomProgName;
        const romanNumeralProgression = COMMON_PROGRESSIONS[randomProgName];

        generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression); // Use currentScaleName

        // 4. Immediately begin playback
        if (isPlaying) {
            stopPlayback(); // Stop current playback before starting new
        }
        togglePlayback(); // Start playing the new one
    }

    function handleKeyChange(event) {
        currentKey = event.target.value;
        console.log("Key changed to:", currentKey);
        regenerateCurrentProgression();
    }

    function handleScaleChange(event) {
        currentScaleName = event.target.value; // Update global state variable
        console.log("Scale changed to:", currentScaleName);
        regenerateCurrentProgression();
    }

    function handleProgressionSelect(event) {
        const selectedProgName = event.target.value;
        const romanNumeralProgression = COMMON_PROGRESSIONS[selectedProgName];
        console.log("Progression selected:", selectedProgName);
        generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression); // Use currentScaleName
    }

    function regenerateCurrentProgression() {
        // This function is called when key or scale changes.
        const selectedProgName = progressionSelector.value;
        const romanNumeralProgression = COMMON_PROGRESSIONS[selectedProgName];
        if (romanNumeralProgression) {
            generateAndDisplayNewProgression(currentKey, currentScaleName, romanNumeralProgression); // Use currentScaleName
        } else {
            console.warn("No common progression selected for regeneration. Using first available.");
            const firstProgKey = Object.keys(COMMON_PROGRESSIONS)[0];
            generateAndDisplayNewProgression(currentKey, currentScaleName, COMMON_PROGRESSIONS[firstProgKey]); // Use currentScaleName
        }
    }

    /**
     * Generates a chord progression based on the key, scale, and Roman numeral degrees, then updates the UI.
     * @param {string} rootNoteName - The root note of the key (e.g., "C").
     * @param {string} scaleNameKey - The identifier for the scale (e.g., "Major").
     * @param {number[]} romanNumeralDegrees - Array of scale degrees (0-indexed) for the progression.
     */
    function generateAndDisplayNewProgression(rootNoteName, scaleNameKey, romanNumeralDegrees) {
        const scaleNoteNamesCurrentOctave = getScaleNoteNames(rootNoteName, scaleNameKey);
        if (scaleNoteNamesCurrentOctave.length === 0) {
            console.error("Could not generate scale notes for", rootNoteName, scaleNameKey);
            currentProgression = [];
            displayChordProgression(); // Clear display
            return;
        }

        let baseOctaveForVoicing = 3; // Starting octave for chords, can be adjusted

        currentProgression = romanNumeralDegrees.map((degree, index) => {
            // Basic sequential voice leading: try to keep subsequent chords near the previous one.
            // This is a very naive implementation. True voice leading is much more complex.
            if (index > 0 && currentProgression[index-1] && currentProgression[index-1].notes.length > 0) {
                const previousChordAvgMidi = currentProgression[index-1].notes.reduce((s,n)=>s+n,0) / currentProgression[index-1].notes.length;
                const currentRootMidiGuess = noteToMidi(scaleNoteNamesCurrentOctave[degree], baseOctaveForVoicing);
                if (currentRootMidiGuess < previousChordAvgMidi - 6) { // If current chord root is too low
                    baseOctaveForVoicing++;
                } else if (currentRootMidiGuess > previousChordAvgMidi + 6) { // If too high
                    baseOctaveForVoicing--;
                }
                // Clamp baseOctaveForVoicing to a reasonable range, e.g., 2 to 4
                baseOctaveForVoicing = Math.max(2, Math.min(4, baseOctaveForVoicing));
            }
            return buildDiatonicTriad(degree, scaleNoteNamesCurrentOctave, baseOctaveForVoicing);
        }).filter(chord => chord !== null); // Filter out any null chords if building failed

        // Ensure progression fills NUM_BARS, repeating if necessary and valid chords were generated
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
            // Potentially reset or handle error more gracefully
            currentProgression = currentProgression.filter(c => c !== null && typeof c !== 'undefined');
        }


        console.log("New Progression:", currentProgression.map(c=>c ? c.name : "Error").join(" - "));
        displayChordProgression();
    }

    // --- Playback Functions ---
    let schedulerTimerID;

    async function togglePlayback() { // Made async
        if (!audioContext || !polyPianoSynth) {
            console.error("AudioContext or PolySynth not initialized.");
            alert("Audio playback system is not ready.");
            return;
        }

        // Start Tone.js context if not already running
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            try {
                await Tone.start();
                console.log("Tone.js AudioContext started by Play button.");
            } catch (e) {
                console.error("Tone.start() failed in togglePlayback:", e);
                alert("Audio context could not be started. Please click Play again.");
                return; // Prevent playback if audio can't start
            }
        }
        // Also resume the base audioContext if it was suspended (though Tone.start() might handle this)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        isPlaying = !isPlaying;
        if (isPlaying) {
            playPauseButton.textContent = "Pause";
            playPauseButton.classList.add('playing');
            playPauseButton.classList.remove('stopped'); // In case it was stopped
            if (playheadPosition >= NUM_BARS) { // If stopped at end, reset
                playheadPosition = 0;
            }
            nextNoteTime = audioContext.currentTime; // Start scheduling from now
            scheduler(); // Start the scheduler
            animationFrameId = requestAnimationFrame(updatePlayhead);
        } else { // When pausing
            playPauseButton.textContent = "Play";
            playPauseButton.classList.remove('playing');
            // playPauseButton.classList.add('paused'); // Or just revert to default
            clearTimeout(schedulerTimerID); // Stop the scheduler
            cancelAnimationFrame(animationFrameId);
            // Optionally, stop all sounding notes (though short notes might not need this)
             masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime); // Hold current gain
             masterGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.1); // Fade out quickly
             setTimeout(() => { // Restore gain after fade out
                 masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
             }, 150);
        }
    }

    function stopPlayback() {
        isPlaying = false;
        playPauseButton.textContent = "Play";
        playPauseButton.classList.remove('playing');
        playPauseButton.classList.add('stopped'); // Could use this for specific styling if needed
        clearTimeout(schedulerTimerID);
        cancelAnimationFrame(animationFrameId);
        playheadPosition = 0;
        nextNoteTime = 0; // Reset scheduling time
        const playheadElement = document.querySelector('.playhead');
        if (playheadElement) {
            playheadElement.style.left = `0%`;
        }
        // Stop all sounding notes
        masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.05);
        setTimeout(() => {
             masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
        }, 100);

        // Clear highlighted keys
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
        const secondsPerBar = secondsPerBeat * 4; // Assuming 4 beats per bar, each chord is a whole note

        nextNoteTime += secondsPerBar;

        playheadPosition++;
        if (playheadPosition >= NUM_BARS) {
            playheadPosition = 0;
            if (!loopEnabled) {
                isPlaying = false; // Stop if not looping
                playPauseButton.textContent = "Play";
                clearTimeout(schedulerTimerID);
                cancelAnimationFrame(animationFrameId);
                // Highlighted keys will clear on next play or stop
                return;
            }
        }
    }

    function scheduleNotesForBar(barIndex, time) {
        if (barIndex >= currentProgression.length) return;

        const chord = currentProgression[barIndex];
        const secondsPerBeat = 60.0 / tempo;
        const noteDuration = secondsPerBeat * 4; // Whole note for the bar

        chord.notes.forEach(midiNote => {
            playPianoNote(midiNote, time, noteDuration);
            highlightPianoKey(midiNote, true, noteDuration * 1000); // Highlight for duration of note
        });
    }

    function playPianoNote(midiNote, startTime, durationSeconds) {
        if (!polyPianoSynth || typeof Tone === 'undefined') {
            console.warn("Tone.js PolySynth not initialized. Cannot play note.");
            return;
        }

        // Ensure Tone.js AudioContext is running. This is crucial.
        // It often needs to be started by a user gesture.
        if (Tone.context.state !== 'running') {
            Tone.start().then(() => {
                console.log("Tone.js AudioContext started by playPianoNote gesture.");
                // Note: The very first note might be missed if Tone.start() is async and resolves later.
                // Ideally, Tone.start() is called earlier from a button click.
                // For this integration, we'll proceed, subsequent notes should play.
                const noteName = Tone.Frequency(midiNote, "midi").toNote();
                polyPianoSynth.triggerAttackRelease(noteName, durationSeconds, startTime);
            }).catch(e => {
                console.error("Error starting Tone.js context from playPianoNote:", e);
                // If Tone.start() fails, we can't play. Alert user or log.
                // alert("Could not start audio. Please interact with the page (e.g. click a button) and try again.");
            });
        } else {
            const noteName = Tone.Frequency(midiNote, "midi").toNote();
            // The 'startTime' from our scheduler is an absolute time in the Web Audio API's AudioContext.
            // Tone.js triggerAttackRelease 'time' parameter also expects an absolute time in the Tone.context timeline.
            // If Tone.context is the same as audioContext, this should align.
            polyPianoSynth.triggerAttackRelease(noteName, durationSeconds, startTime);
        }
    }

    // midiToFrequency is no longer used after Tone.js integration for both live playback and WAV export.
    // function midiToFrequency(midi) {
    //     return Math.pow(2, (midi - 69) / 12) * 440;
    // }

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

        // Assuming MidiWriterjs is loaded globally from the script tag in index.html
        if (typeof MidiWriter === 'undefined') {
            alert("MIDI Writer library not loaded. Cannot export MIDI.");
            console.error("MidiWriter is not defined.");
            return;
        }

        const track = new MidiWriter.Track();
        track.setTempo(tempo); // Set current tempo. MIDI tempo is in BPM.

        // Default duration for each chord (e.g., whole note for each bar)
        // MidiWriter duration values: '1' (whole), '2' (half), '4' (quarter), etc.
        // Or tick values like 'T128' (128 ticks).
        // Assuming 4/4 time, one chord per bar, so a whole note.
        const noteDuration = '1';

        currentProgression.forEach(chord => {
            if (chord && chord.notes && chord.notes.length > 0) {
                const chordEvent = new MidiWriter.NoteEvent({
                    pitch: chord.notes, // Array of MIDI note numbers
                    duration: noteDuration,
                    sequential: false // Important: play notes simultaneously for a chord
                });
                track.addEvent(chordEvent);
            } else {
                // If a bar is empty or chord is invalid, add a rest.
                // A rest is a note event with velocity 0 or a specific rest event if supported.
                // For simplicity, add a silent note event if the library doesn't have a dedicated RestEvent.
                // MidiWriter.NoteEvent with velocity 0 might not be standard for all sequencers.
                // A common practice is to just advance time, but here each event has a duration.
                // Let's add a single, very low, silent note as a placeholder for a rest.
                const restEvent = new MidiWriter.NoteEvent({
                    pitch: [0], // A very low note, effectively silent or out of range
                    duration: noteDuration,
                    velocity: 0 // Velocity 0 means silent
                });
                track.addEvent(restEvent);
            }
        });

        const writer = new MidiWriter.Writer([track]);
        const midiDataUri = writer.dataUri();

        // Trigger download
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
    const format = opt_params.float32 ? 3 : 1; // 1 = 16-bit PCM, 3 = 32-bit float
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

    writeStringView(view, 0, 'RIFF');                      // RIFF identifier
    view.setUint32(4, 36 + dataSize, true);            // RIFF chunk length
    writeStringView(view, 8, 'WAVE');                      // RIFF type
    writeStringView(view, 12, 'fmt ');                     // format chunk identifier
    view.setUint32(16, 16, true);                      // format chunk length
    view.setUint16(20, format, true);                  // sample format (raw)
    view.setUint16(22, numChannels, true);             // number of channels
    view.setUint32(24, sampleRate, true);              // sample rate
    view.setUint32(28, byteRate, true);                // byte rate (sample rate * block align)
    view.setUint16(32, blockAlign, true);              // block align (channel count * bytes per sample)
    view.setUint16(34, bitDepth, true);                // bits per sample
    writeStringView(view, 36, 'data');                     // data chunk identifier
    view.setUint32(40, dataSize, true);                // data chunk length

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

    // Tone.start might be needed if the context was not started by a user gesture yet.
    // However, Tone.Offline should handle its own context.
    if (Tone.context.state !== 'running') {
        await Tone.start().catch(e => {
            console.error("Tone.start() failed before WAV export:", e);
            alert("Audio context could not be started. Please interact with the page first.");
            return; // Stop if Tone can't start
        });
    }

    const originalIsPlaying = isPlaying; // Simpler state to restore check
    if (isPlaying) {
        stopButton.click(); // Stop live playback
    }

    const secondsPerBeat = 60.0 / tempo;
    const beatsPerBar = 4;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    const totalDurationSeconds = NUM_BARS * secondsPerBar;

    try {
        console.log("Starting Tone.Offline rendering for WAV export...");

        const renderedBuffer = await Tone.Offline(async (offlineTransport) => {
            // Use the globally defined FMSynth options for consistency
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
            // No need to call offlineTransport.start() if scheduling with absolute times for triggerAttackRelease
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
        if (originalIsPlaying) { // Check if it was playing before
             console.log("Playback was stopped for WAV export. Please press Play to resume if desired.");
        }
    }
    }

    // --- Start the application ---
    init();
});

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
