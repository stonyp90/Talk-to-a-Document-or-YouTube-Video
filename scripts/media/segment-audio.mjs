#!/usr/bin/env node
// segment-audio.mjs — Split audio track only, optimized for transcription
// Usage: node scripts/media/segment-audio.mjs <input> --duration <seconds> [--format <wav|mp3|flac>]

import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: segment-audio.mjs <input> --duration <seconds> [--format <format>]');
  process.exit(1);
}

const input = args[0];
let duration = 60;
let format = 'wav'; // wav for lossless PCM, flac for compressed lossless
let outputDir = null;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--duration' && args[i + 1]) duration = parseFloat(args[++i]);
  if (args[i] === '--format' && args[i + 1]) format = args[++i];
  if (args[i] === '--output-dir' && args[i + 1]) outputDir = args[++i];
}

if (!existsSync(input)) {
  console.error(`ERROR: Input not found: ${input}`);
  process.exit(1);
}

const probe = execFileSync('ffprobe', [
  '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', input
], { encoding: 'utf-8' });
const info = JSON.parse(probe);

const audioStream = info.streams.find(s => s.codec_type === 'audio');
if (!audioStream) {
  console.error('ERROR: No audio stream found');
  process.exit(1);
}

const totalDuration = parseFloat(info.format.duration);
const numSegments = Math.ceil(totalDuration / duration);

if (!outputDir) {
  const name = basename(input, extname(input));
  outputDir = join(process.cwd(), `${name}_audio_segments`);
}
mkdirSync(outputDir, { recursive: true });

const codec = format === 'wav' ? 'pcm_s16le' : format === 'flac' ? 'flac' : 'libmp3lame';
const ext = format === 'wav' ? 'wav' : format === 'flac' ? 'flac' : 'mp3';

console.log(`Audio: ${audioStream.sample_rate}Hz, ${audioStream.channels}ch, ${totalDuration.toFixed(1)}s`);
console.log(`Segments: ${numSegments} x ${duration}s, format: ${format}`);

const startTime = Date.now();
const segments = [];
let completed = 0;

async function processSegment(i) {
  const start = i * duration;
  const segDuration = Math.min(duration, totalDuration - start);
  const outFile = join(outputDir, `seg_${String(i).padStart(3, '0')}.${ext}`);

  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', input,
      '-ss', start.toString(),
      '-t', segDuration.toString(),
      '-map', '0:a',
      '-c:a', codec,
      '-ar', audioStream.sample_rate,
      '-y', outFile
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-200)));
    });
  });

  segments.push({ index: i, start, end: start + segDuration, file: outFile });
  completed++;
  console.log(`[${((completed / numSegments) * 100).toFixed(0)}%] Segment ${i + 1}/${numSegments}`);
}

// Process all in parallel (audio is lightweight)
await Promise.all(Array.from({ length: numSegments }, (_, i) => processSegment(i)));

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone: ${numSegments} audio segments in ${totalTime}s`);
console.log(`Output: ${outputDir}`);

writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({
  source: input,
  totalDuration,
  segmentDuration: duration,
  format,
  numSegments,
  totalTime: parseFloat(totalTime),
  segments,
}, null, 2));
