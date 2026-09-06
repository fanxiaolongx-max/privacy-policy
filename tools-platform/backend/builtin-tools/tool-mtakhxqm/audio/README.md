# Arabic neural audio assets

These files are AI-generated speech, not recordings of human speakers.

- Egyptian Arabic: `ar-EG-SalmaNeural` (female)
- Modern Standard Arabic text: `ar-SA-ZariyahNeural` (female)
- Encoding: MP3, 24 kHz, mono, 48 kbps
- Speaking rate: `-12%` for language-learning clarity

`manifest.json` maps each lesson string, individual word, Arabic letter, and
vowelled letter exercise to its Egyptian and/or standard-Arabic audio files.
Letter audio speaks the Arabic letter name (for example, `ب` plays `باء`). The
syllable collection covers every one of the 28 letters with fatḥa, kasra, ḍamma,
and sukūn/ending practice. Regenerate the assets from the tool directory with:

```bash
EDGE_TTS_BIN=/absolute/path/to/edge-tts node generate-neural-audio.mjs
```
