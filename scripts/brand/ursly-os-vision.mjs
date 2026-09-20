#!/usr/bin/env node
/**
 * Ursly OS Vision Video - 30 seconds
 * "Le dernier OS dont vous aurez besoin"
 */

import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION = 30;
const TOTAL_FRAMES = FPS * DURATION;

const COLORS = {
  paper: '#f8f5ef',
  ink: '#292735',
  muted: '#716c78',
  accent: '#a84332',
  hairline: '#d4d0c8',
  screen: '#ffffff',
};

const workDir = '/tmp/ursly-os-video';
const framesDir = join(workDir, 'frames');
mkdirSync(framesDir, { recursive: true });

const number = (v) => Math.round(v * 100) / 100;
const clamp = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function createFrameSVG(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.paper}"/>
    ${content}
  </svg>`;
}

function box({ x, y, width, height, r = 0, fill, stroke, strokeWidth = 0, opacity = 1 }) {
  const attrs = `x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" rx="${r}" fill="${fill || 'none'}" opacity="${number(opacity)}"`;
  if (stroke) {
    return `<rect ${attrs} stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  return `<rect ${attrs}/>`;
}

function circle({ x, y, r, fill, opacity = 1 }) {
  return `<circle cx="${number(x)}" cy="${number(y)}" r="${number(r)}" fill="${fill}" opacity="${number(opacity)}"/>`;
}

function text({ x, y, value, size, fill, weight = '400', anchor = 'start', opacity = 1 }) {
  return `<text x="${number(x)}" y="${number(y)}" font-family="system-ui, -apple-system, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${number(opacity)}">${value}</text>`;
}

// SVG icon shapes (no Unicode)
function keyboardIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <rect x="${x - s}" y="${y - s * 0.6}" width="${s * 2}" height="${s * 1.2}" rx="8" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x - s * 0.7}" y1="${y - s * 0.2}" x2="${x - s * 0.3}" y2="${y - s * 0.2}" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
    <line x1="${x - s * 0.1}" y1="${y - s * 0.2}" x2="${x + s * 0.3}" y2="${y - s * 0.2}" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
    <line x1="${x + s * 0.5}" y1="${y - s * 0.2}" x2="${x + s * 0.7}" y2="${y - s * 0.2}" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
    <line x1="${x - s * 0.5}" y1="${y + s * 0.2}" x2="${x + s * 0.5}" y2="${y + s * 0.2}" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
  `;
}

function mouseIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <ellipse cx="${x}" cy="${y}" rx="${s * 0.6}" ry="${s}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x}" y1="${y - s * 0.5}" x2="${x}" y2="${y + s * 0.3}" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
  `;
}

function phoneIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <rect x="${x - s * 0.5}" y="${y - s}" width="${s}" height="${s * 2}" rx="8" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <circle cx="${x}" cy="${y + s * 0.7}" r="${s * 0.15}" fill="${fill}" opacity="${opacity}"/>
  `;
}

function micIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <rect x="${x - s * 0.2}" y="${y - s * 0.8}" width="${s * 0.4}" height="${s * 1.2}" rx="${s * 0.2}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <path d="M ${x - s * 0.5} ${y - s * 0.2} Q ${x - s * 0.5} ${y + s * 0.6} ${x} ${y + s * 0.6} Q ${x + s * 0.5} ${y + s * 0.6} ${x + s * 0.5} ${y - s * 0.2}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x}" y1="${y + s * 0.6}" x2="${x}" y2="${y + s * 1}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x - s * 0.3}" y1="${y + s * 1}" x2="${x + s * 0.3}" y2="${y + s * 1}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
  `;
}

function watchIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <rect x="${x - s * 0.5}" y="${y - s * 0.6}" width="${s}" height="${s * 1.2}" rx="6" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x - s * 0.5}" y1="${y - s * 0.3}" x2="${x - s * 0.8}" y2="${y - s * 0.3}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x - s * 0.5}" y1="${y + s * 0.3}" x2="${x - s * 0.8}" y2="${y + s * 0.3}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x + s * 0.5}" y1="${y - s * 0.3}" x2="${x + s * 0.8}" y2="${y - s * 0.3}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <line x1="${x + s * 0.5}" y1="${y + s * 0.3}" x2="${x + s * 0.8}" y2="${y + s * 0.3}" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
  `;
}

function carIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <path d="M ${x - s * 0.8} ${y + s * 0.3} L ${x - s * 0.6} ${y - s * 0.3} L ${x + s * 0.6} ${y - s * 0.3} L ${x + s * 0.8} ${y + s * 0.3} Z" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <circle cx="${x - s * 0.5}" cy="${y + s * 0.4}" r="${s * 0.2}" fill="none" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
    <circle cx="${x + s * 0.5}" cy="${y + s * 0.4}" r="${s * 0.2}" fill="none" stroke="${fill}" stroke-width="3" opacity="${opacity}"/>
  `;
}

function homeIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <path d="M ${x} ${y - s * 0.8} L ${x + s * 0.8} ${y} L ${x + s * 0.6} ${y} L ${x + s * 0.6} ${y + s * 0.8} L ${x - s * 0.6} ${y + s * 0.8} L ${x - s * 0.6} ${y} L ${x - s * 0.8} ${y} Z" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
  `;
}

function brainIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <path d="M ${x - s * 0.6} ${y} Q ${x - s * 0.8} ${y - s * 0.6} ${x - s * 0.3} ${y - s * 0.7} Q ${x} ${y - s * 0.9} ${x + s * 0.3} ${y - s * 0.7} Q ${x + s * 0.8} ${y - s * 0.6} ${x + s * 0.6} ${y} Q ${x + s * 0.7} ${y + s * 0.5} ${x + s * 0.3} ${y + s * 0.6} Q ${x} ${y + s * 0.7} ${x - s * 0.3} ${y + s * 0.6} Q ${x - s * 0.7} ${y + s * 0.5} ${x - s * 0.6} ${y}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <path d="M ${x - s * 0.3} ${y - s * 0.5} Q ${x} ${y - s * 0.3} ${x + s * 0.3} ${y - s * 0.5}" fill="none" stroke="${fill}" stroke-width="3" opacity="${opacity * 0.6}"/>
    <path d="M ${x - s * 0.4} ${y} Q ${x} ${y + s * 0.2} ${x + s * 0.4} ${y}" fill="none" stroke="${fill}" stroke-width="3" opacity="${opacity * 0.6}"/>
  `;
}

function personIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `
    <circle cx="${x}" cy="${y - s * 0.5}" r="${s * 0.4}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
    <path d="M ${x - s * 0.6} ${y + s * 0.8} Q ${x - s * 0.6} ${y + s * 0.2} ${x} ${y + s * 0.2} Q ${x + s * 0.6} ${y + s * 0.2} ${x + s * 0.6} ${y + s * 0.8}" fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>
  `;
}

function checkIcon({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `<path d="M ${x - s * 0.5} ${y} L ${x - s * 0.1} ${y + s * 0.5} L ${x + s * 0.5} ${y - s * 0.4}" fill="none" stroke="${fill}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

function arrowRight({ x, y, size, fill, opacity }) {
  const s = size / 2;
  return `<path d="M ${x - s} ${y} L ${x + s} ${y} M ${x + s * 0.5} ${y - s * 0.4} L ${x + s} ${y} L ${x + s * 0.5} ${y + s * 0.4}" fill="none" stroke="${fill}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

// Scene 1: The Problem (0-4s)
function scene1Problem(t) {
  const progress = clamp(t / 4);
  const devices = [
    { icon: keyboardIcon, label: 'Keyboard', x: 200, y: 300 },
    { icon: mouseIcon, label: 'Mouse', x: 600, y: 300 },
    { icon: phoneIcon, label: 'Touch', x: 1000, y: 300 },
    { icon: micIcon, label: 'Voice (fails)', x: 1400, y: 300 },
  ];

  let content = '';

  const titleOpacity = easeOut(clamp((progress - 0.1) * 3));
  content += text({
    x: WIDTH / 2, y: 150,
    value: '40 years of interfaces.',
    size: 72, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity: titleOpacity,
  });
  content += text({
    x: WIDTH / 2, y: 220,
    value: 'Still as clumsy as day one.',
    size: 48, fill: COLORS.muted, anchor: 'middle', opacity: titleOpacity,
  });

  devices.forEach((device, i) => {
    const deviceProgress = clamp((progress - 0.2 - i * 0.15) * 4);
    const opacity = easeOut(deviceProgress);
    const y = device.y + (1 - opacity) * 100;

    content += box({
      x: device.x - 80, y: y - 80, width: 160, height: 160, r: 20,
      fill: COLORS.hairline, opacity: opacity * 0.3,
    });
    content += device.icon({ x: device.x, y: y - 10, size: 80, fill: COLORS.ink, opacity });
    content += text({
      x: device.x, y: y + 120,
      value: device.label, size: 24, fill: COLORS.muted, anchor: 'middle', opacity,
    });
  });

  return content;
}

// Scene 2: The Breakthrough (4-8s)
function scene2Breakthrough(t) {
  const progress = clamp((t - 4) / 4);
  const opacity = easeOut(progress);

  let content = '';
  const personX = 400;
  const personY = 400;

  content += box({
    x: personX - 100, y: personY - 150, width: 200, height: 300, r: 100,
    fill: COLORS.hairline, opacity: opacity * 0.5,
  });
  content += personIcon({ x: personX, y: personY, size: 120, fill: COLORS.ink, opacity });

  const waveOpacity = easeOut(clamp((progress - 0.3) * 2));
  for (let i = 0; i < 5; i++) {
    const waveX = personX + 150 + i * 40;
    const waveHeight = 60 - i * 8;
    content += box({
      x: waveX, y: personY - waveHeight / 2, width: 8, height: waveHeight, r: 4,
      fill: COLORS.accent, opacity: waveOpacity * (1 - i * 0.15),
    });
  }

  const urslyOpacity = easeOut(clamp((progress - 0.5) * 2));
  content += box({
    x: 900, y: 350, width: 200, height: 100, r: 20,
    fill: COLORS.accent, opacity: urslyOpacity,
  });
  content += text({
    x: 1000, y: 410,
    value: 'URSLY', size: 36, fill: COLORS.paper, weight: '700', anchor: 'middle', opacity: urslyOpacity,
  });

  const actionOpacity = easeOut(clamp((progress - 0.7) * 3));
  content += checkIcon({ x: 1370, y: 400, size: 40, fill: COLORS.ink, opacity: actionOpacity });
  content += text({
    x: 1430, y: 410,
    value: 'Email sent', size: 48, fill: COLORS.ink, weight: '700', anchor: 'start', opacity: actionOpacity,
  });

  const quoteOpacity = easeOut(clamp((progress - 0.2) * 2));
  content += text({
    x: WIDTH / 2, y: 700,
    value: '"Ursly, send my health data to my doctor"',
    size: 42, fill: COLORS.ink, anchor: 'middle', opacity: quoteOpacity,
  });
  content += text({
    x: WIDTH / 2, y: 780,
    value: 'An OS that understands intention, not commands.',
    size: 36, fill: COLORS.muted, anchor: 'middle', opacity: quoteOpacity,
  });

  return content;
}

// Scene 3: The Proof (8-16s)
function scene3Proof(t) {
  const progress = clamp((t - 8) / 8);

  let content = '';

  const titleOpacity = easeOut(clamp(progress * 3));
  content += text({
    x: WIDTH / 2, y: 120,
    value: 'One intention. All systems.',
    size: 64, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity: titleOpacity,
  });

  const devices = [
    { icon: phoneIcon, label: 'Phone', action: 'Open Spotify', x: 480, y: 400 },
    { icon: watchIcon, label: 'Watch', action: 'Send heart rate', x: 1440, y: 400 },
    { icon: carIcon, label: 'Car', action: 'Set temperature', x: 480, y: 700 },
    { icon: homeIcon, label: 'Home', action: 'Turn on lights', x: 1440, y: 700 },
  ];

  devices.forEach((device, i) => {
    const deviceProgress = clamp((progress - 0.1 - i * 0.1) * 3);
    const opacity = easeOut(deviceProgress);
    const scale = 0.8 + opacity * 0.2;

    content += box({
      x: device.x - 150 * scale, y: device.y - 100 * scale,
      width: 300 * scale, height: 200 * scale, r: 20,
      fill: COLORS.screen, stroke: COLORS.hairline, strokeWidth: 2, opacity: 1,
    });

    content += device.icon({ x: device.x, y: device.y - 30, size: 80, fill: COLORS.ink, opacity });
    content += text({
      x: device.x, y: device.y + 40,
      value: device.label, size: 28, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity,
    });
    content += text({
      x: device.x, y: device.y + 80,
      value: device.action, size: 20, fill: COLORS.muted, anchor: 'middle', opacity: opacity * 0.8,
    });

    const checkOpacity = easeOut(clamp((deviceProgress - 0.5) * 2));
    content += checkIcon({
      x: device.x + 120, y: device.y - 70,
      size: 36, fill: COLORS.accent, opacity: checkOpacity,
    });
  });

  return content;
}

// Scene 4: The Future (16-22s)
function scene4Future(t) {
  const progress = clamp((t - 16) / 6);

  let content = '';
  const brainX = WIDTH / 2;
  const brainY = 400;
  const brainOpacity = easeOut(progress);

  content += box({
    x: brainX - 150, y: brainY - 120, width: 300, height: 240, r: 120,
    fill: COLORS.hairline, opacity: brainOpacity * 0.3,
  });
  content += brainIcon({ x: brainX, y: brainY, size: 180, fill: COLORS.ink, opacity: brainOpacity });

  const waveOpacity = easeOut(clamp((progress - 0.3) * 2));
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 200 + Math.sin(t * 2 + i) * 20;
    const waveX = brainX + Math.cos(angle) * radius;
    const waveY = brainY + Math.sin(angle) * radius;

    content += circle({
      x: waveX, y: waveY, r: 10,
      fill: COLORS.accent, opacity: waveOpacity * 0.6,
    });
  }

  const arrowOpacity = easeOut(clamp((progress - 0.5) * 2));
  content += arrowRight({
    x: brainX + 350, y: brainY, size: 60, fill: COLORS.accent, opacity: arrowOpacity,
  });

  const urslyOpacity = easeOut(clamp((progress - 0.6) * 2));
  content += box({
    x: brainX + 500, y: brainY - 50, width: 150, height: 100, r: 20,
    fill: COLORS.accent, opacity: urslyOpacity,
  });
  content += text({
    x: brainX + 575, y: brainY + 10,
    value: 'URSLY', size: 32, fill: COLORS.paper, weight: '700', anchor: 'middle', opacity: urslyOpacity,
  });

  const quoteOpacity = easeOut(clamp((progress - 0.4) * 2));
  content += text({
    x: WIDTH / 2, y: 750,
    value: 'Tomorrow, you think. Ursly acts.',
    size: 56, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity: quoteOpacity,
  });
  content += text({
    x: WIDTH / 2, y: 820,
    value: 'Brain-computer interfaces. 2028 and beyond.',
    size: 32, fill: COLORS.muted, anchor: 'middle', opacity: quoteOpacity,
  });

  return content;
}

// Scene 5: The Market (22-26s)
function scene5Market(t) {
  const progress = clamp((t - 22) / 4);

  let content = '';

  const titleOpacity = easeOut(clamp(progress * 3));
  content += text({
    x: WIDTH / 2, y: 150,
    value: 'Monopoly position on human-machine interface',
    size: 56, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity: titleOpacity,
  });

  const markets = [
    { label: 'OS Market', value: '$300B', y: 300 },
    { label: 'Voice AI', value: '$50B', y: 450 },
    { label: 'BCI (2030)', value: '$10B', y: 600 },
    { label: 'Competitors (voice+motion+BCI)', value: '0', y: 750 },
  ];

  markets.forEach((market, i) => {
    const marketProgress = clamp((progress - 0.05 - i * 0.12) * 3);
    const opacity = easeOut(marketProgress);

    content += text({
      x: 860, y: market.y,
      value: market.label, size: 36, fill: COLORS.muted, anchor: 'end', opacity,
    });
    content += text({
      x: 900, y: market.y,
      value: market.value, size: 48,
      fill: market.value === '0' ? COLORS.accent : COLORS.ink,
      weight: '700', anchor: 'start', opacity,
    });
  });

  return content;
}

// Scene 6: The Call (26-30s)
function scene6Call(t) {
  const progress = clamp((t - 26) / 4);
  const opacity = easeOut(progress);

  let content = '';

  content += box({
    x: WIDTH / 2 - 200, y: 300, width: 400, height: 200, r: 40,
    fill: COLORS.accent, opacity,
  });
  content += text({
    x: WIDTH / 2, y: 420,
    value: 'URSLY', size: 96, fill: COLORS.paper, weight: '700', anchor: 'middle', opacity,
  });

  const taglineOpacity = easeOut(clamp((progress - 0.3) * 2));
  content += text({
    x: WIDTH / 2, y: 600,
    value: 'The last OS you will ever need.',
    size: 48, fill: COLORS.ink, weight: '700', anchor: 'middle', opacity: taglineOpacity,
  });

  const contactOpacity = easeOut(clamp((progress - 0.6) * 2));
  content += text({
    x: WIDTH / 2, y: 750,
    value: 'Seed round: $5M', size: 36, fill: COLORS.muted, anchor: 'middle', opacity: contactOpacity,
  });
  content += text({
    x: WIDTH / 2, y: 820,
    value: 'founders@ursly.com', size: 32, fill: COLORS.accent, anchor: 'middle', opacity: contactOpacity,
  });

  return content;
}

// Main render loop
console.log('Rendering Ursly OS Vision Video...');
console.log(`  ${TOTAL_FRAMES} frames at ${FPS}fps = ${DURATION}s`);

const scenes = [
  { start: 0, end: 4, fn: scene1Problem },
  { start: 4, end: 8, fn: scene2Breakthrough },
  { start: 8, end: 16, fn: scene3Proof },
  { start: 16, end: 22, fn: scene4Future },
  { start: 22, end: 26, fn: scene5Market },
  { start: 26, end: 30, fn: scene6Call },
];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  let currentScene = scenes.find((s) => t >= s.start && t < s.end);
  if (!currentScene) currentScene = scenes[scenes.length - 1];

  const svg = createFrameSVG(currentScene.fn(t));
  writeFileSync(join(framesDir, `frame-${String(frame).padStart(5, '0')}.svg`), svg);

  if (frame % 90 === 0) {
    console.log(`  Frame ${frame}/${TOTAL_FRAMES} (${Math.round((frame / TOTAL_FRAMES) * 100)}%)`);
  }
}

console.log('SVG frames rendered. Rasterizing to PNG...');

const pngDir = join(workDir, 'png');
mkdirSync(pngDir, { recursive: true });

const svgFiles = readdirSync(framesDir).filter((f) => f.endsWith('.svg')).sort();

for (let i = 0; i < svgFiles.length; i++) {
  const svgFile = join(framesDir, svgFiles[i]);
  const pngFile = join(pngDir, svgFiles[i].replace('.svg', '.png'));
  try {
    execFileSync('rsvg-convert', [
      '-w', String(WIDTH),
      '-h', String(HEIGHT),
      '-f', 'png',
      '-o', pngFile,
      svgFile,
    ], { stdio: 'pipe' });
  } catch (err) {
    console.error(`Failed to rasterize ${svgFiles[i]}:`, err.stderr?.toString() || err.message);
    process.exit(1);
  }
  if (i % 90 === 0) {
    console.log(`  PNG ${i}/${svgFiles.length} (${Math.round((i / svgFiles.length) * 100)}%)`);
  }
}

console.log('PNG rasterization complete. Assembling video...');

const outputPath = '/Users/tony/Github/Talk-to-a-Document-or-YouTube-Video/apps/web/public/brand/ursly-os-vision.mp4';

try {
  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', join(pngDir, 'frame-%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-preset', 'medium',
    '-crf', '18',
    outputPath,
  ], { stdio: 'inherit' });
  console.log(`\nVideo created: ${outputPath}`);
} catch (error) {
  console.error('Error creating video:', error.message);
  process.exit(1);
}

console.log('Cleaning up temporary files...');
rmSync(workDir, { recursive: true, force: true });

console.log('Done!');
