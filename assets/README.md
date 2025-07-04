This directory is intended to store audio assets, such as piano samples in .mp3 or .ogg format.

For the ChordFlow application to use sampled audio, at least one piano sample is expected, for example:
- `piano-C4.mp3` (a sample of a piano playing the C4 note)

If samples are not available or fail to load, the application will fall back to using synthesized sounds (e.g., sine or triangle waves).

To add samples:
1. Place your audio files (e.g., `piano-C4.mp3`) in this `assets` directory.
2. Update the `PIANO_SAMPLES` configuration in `script.js` to point to your files and specify the MIDI note they correspond to. For example:
   ```javascript
   const PIANO_SAMPLES = {
       60: 'assets/piano-C4.mp3', // 60 is MIDI for C4
       // Add more samples here for different notes/octaves if desired
       // 72: 'assets/piano-C5.mp3',
   };
   const DEFAULT_SAMPLE_MIDI_NOTE = 60; // Update if your primary sample is not C4
   ```

The application uses the `DEFAULT_SAMPLE_MIDI_NOTE`'s corresponding audio file and adjusts its playback rate to produce other pitches. Using multiple samples across different octaves can improve audio quality.
