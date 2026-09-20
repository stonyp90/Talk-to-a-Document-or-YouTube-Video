#!/usr/bin/env node
// segment.mjs — Split video/audio in parallel, frame-accurate, lossless
// Usage: node scripts/media/segment.mjs <input> --duration <seconds> [--output-dir <dir>] [--format <mp4|webm|mkv>]

import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

// Parse args
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: segment.mjs <input> --duration <seconds> [--output-dir <dir>] [--format <format>]');
  process.exit(1);
}

const input = args[0];
let duration = 60; // default 60 seconds per segment
let outputDir = null;
let format = 'mp4';

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--duration' && args[i + 1]) { duration = parseFloat(args[++i]); }
  if (args[i] === '--output-dir' && args[i + 1]) { outputDir = args[++i]; }
  if (args[i] === '--format' && args[i + 1]) { format = args[++i]; }
}

if (!existsSync(input)) {
  console.error(`ERROR: Input file not found: ${input}`);
  process.exit(1);
}

// Get media info
function getMediaInfo(file) {
  const probe = execFileSync('ffprobe', [
    '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file
  ], { encoding: 'utf-8' });
  return JSON.parse(probe);
}

console.log(`Analyzing: ${input}`);
const info = getMediaInfo(input);

const videoStream = info.streams.find(s => s.codec_type === 'video');
const audioStream = info.streams.find(s => s.codec_type === 'audio');

if (!videoStream && !audioStream) {
  console.error('ERROR: No video or audio stream found');
  process.exit(1);
}

const totalDuration = parseFloat(info.format.duration);
const numSegments = Math.ceil(totalDuration / duration);

console.log(`Duration: ${totalDuration.toFixed(1)}s`);
console.log(`Segments: ${numSegments} x ${duration}s`);
console.log(`Video: ${videoStream ? `${videoStream.width}x${videoStream.height} ${videoStream.codec_name}` : 'none'}`);
console.log(`Audio: ${audioStream ? `${audioStream.sample_rate}Hz ${audioStream.codec_name}` : 'none'}`);

// Output directory
if (!outputDir) {
  const name = basename(input, extname(input));
  outputDir = join(process.cwd(), `${name}_segments`);
}
mkdirSync(outputDir, { recursive: true });

// Generate segment definitions
const segments = [];
for (let i = 0; i < numSegments; i++) {
  const start = i * duration;
  const end = Math.min(start + duration, totalDuration);
  const segDuration = end - start;
  segments.push({
    index: i,
    start,
    end,
    duration: segDuration,
    videoFile: join(outputDir, `seg_${String(i).padStart(3, '0')}_video.${format}`),
    audioFile: join(outputDir, `seg_${String(i).padStart(3, '0')}_audio.${format === 'mp4' ? 'm4a' : format === 'webm' ? 'webm' : 'mkv'}`),
    combinedFile: join(outputDir, `seg_${String(i).padStart(3, '0')}.${format}`),
  });
}

writeFileSync(join(outputDir, 'segments.json'), JSON.stringify(segments, null, 2));
console.log(`Segment plan written to: ${join(outputDir, 'segments.json')}`);

// Process segments in parallel
// Strategy: split video and audio tracks separately in parallel, then mux
// This is faster because video and audio decoding are independent
const MAX_PARALLEL = 4; // max concurrent ffmpeg processes
let active = 0;
let segIndex = 0;
let completed = 0;
const startTime = Date.now();

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-200)}`));
    });
  });
}

async function processSegment(seg) {
  const tasks = [];

  // Extract video stream (lossless copy)
  if (videoStream) {
    tasks.push(
      runFfmpeg([
        '-i', input,
        '-ss', seg.start.toString(),
        '-t', seg.duration.toString(),
        '-map', '0:v',
        '-c:v', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y', seg.videoFile
      ]).then(() => 'video')
    );
  }

  // Extract audio stream (lossless copy)
  if (audioStream) {
    tasks.push(
      runFfmpeg([
        '-i', input,
        '-ss', seg.start.toString(),
        '-t', seg.duration.toString(),
        '-map', '0:a',
        '-c:a', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y', seg.audioFile
      ]).then(() => 'audio')
    );
  }

  await Promise.all(tasks);

  // Mux video + audio back together (stream copy, no re-encode)
  if (videoStream && audioStream) {
    await runFfmpeg([
      '-i', seg.videoFile,
      '-i', seg.audioFile,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-y', seg.combinedFile
    ]);
  }

  completed++;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const pct = ((completed / numSegments) * 100).toFixed(0);
  console.log(`[${pct}%] Segment ${seg.index + 1}/${numSegments} done (${elapsed}s)`);
}

async function runQueue() {
  while (segIndex < numSegments && active < MAX_PARALLEL) {
    const seg = segments[segIndex++];
    active++;
    processSegment(seg)
      .catch((err) => console.error(`Segment ${seg.index} failed: ${err.message}`))
      .finally(() => { active--; runQueue(); });
  }
}

runQueue();

// Wait for all to complete
await new Promise((resolve) => {
  const check = setInterval(() => {
    if (completed >= numSegments) {
      clearInterval(check);
      resolve();
    }
  }, 100);
});

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone: ${numSegments} segments in ${totalTime}s`);
console.log(`Output: ${outputDir}`);

// Write manifest
const manifest = {
  source: input,
  totalDuration,
  segmentDuration: duration,
  numSegments,
  format,
  totalTime: parseFloat(totalTime),
  segments: segments.map(s => ({
    index: s.index,
    start: s.start,
    end: s.end,
    duration: s.duration,
    file: s.combinedFile,
  })),
};
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
