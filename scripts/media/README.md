# Media Segmentation Tools

Split video and audio for parallel processing. No quality loss. Frame-accurate.

## Requirements

- ffmpeg (with ffprobe) installed and on PATH
- Node.js 22+

## Video + Audio segmentation

```bash
node scripts/media/segment.mjs <input.mp4> --duration 60
node scripts/media/segment.mjs <input.mp4> --duration 30 --format webm --output-dir ./out
```

Splits video and audio tracks in parallel (stream copy, no re-encode), then muxes back together.

## Audio-only segmentation (for transcription)

```bash
node scripts/media/segment-audio.mjs <input.mp4> --duration 60
node scripts/media/segment-audio.mjs <input.mp4> --duration 30 --format flac
```

Formats: wav (lossless PCM), flac (compressed lossless), mp3 (lossy).

## How it works

1. **Probe** -- ffprobe reads duration, streams, codec info
2. **Plan** -- generates segment boundaries at exact frame positions
3. **Split in parallel** -- video and audio extracted simultaneously (up to 4 concurrent ffmpeg processes)
4. **Mux** -- streams recombined with stream copy (no quality loss)
5. **Manifest** -- JSON manifest with all segment metadata

## Speed

The more segments, the faster -- parallelization scales with CPU cores.
A 3-minute video split into 6 x 30s segments processes ~3x faster than sequential.
