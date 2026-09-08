import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';

// One vector master for the web, native headers, launcher icons and splash.
const coral = '#F27561', ink = '#292735', paper = '#F8F5EF';
const bars = [
  [27, 43, 6, 14], [37, 30, 6, 40], [47, 35, 6, 30],
  [57, 30, 6, 40], [67, 39, 6, 22],
];
const wave = (color) => bars.map(([x,y,w,h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${color}"/>`).join('');
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">${body}</svg>`;
const mark = svg(`<rect width="100" height="100" rx="30" fill="${coral}"/>${wave(ink)}`);
const app = svg(`<rect width="100" height="100" fill="${coral}"/>${wave(ink)}`);
const foreground = svg(wave(ink)); // Android's central safe zone, on a coral system background.
const monochrome = svg(wave('#FFFFFF'));
for (const directory of ['apps/mobile/assets', 'apps/web/public/brand']) await mkdir(directory, { recursive: true });
async function png(source, size, path) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(await loadImage(Buffer.from(source)), 0, 0, size, size);
  const bytes = canvas.toBuffer('image/png');
  await writeFile(path, bytes);
  return bytes;
}
await writeFile('apps/web/public/brand/ursly-mark.svg', mark);
await writeFile('apps/web/app/icon.svg', mark);
await png(mark, 256, 'apps/mobile/assets/brand-mark.png');
await png(app, 1024, 'apps/mobile/assets/icon.png');
await png(foreground, 1024, 'apps/mobile/assets/adaptive-icon.png');
await png(monochrome, 1024, 'apps/mobile/assets/monochrome-icon.png');
await png(mark, 512, 'apps/mobile/assets/splash-icon.png');
await png(app, 180, 'apps/web/app/apple-icon.png');
for (const size of [192, 512]) await png(app, size, `apps/web/public/brand/icon-${size}.png`);
// PNG-backed ICO directory with crisp small-size variants.
const sizes = [16, 32, 48];
const entries = await Promise.all(sizes.map(size => png(mark, size, `apps/web/public/brand/favicon-${size}.png`)));
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((bytes, i) => {
  const at = 6 + i * 16;
  header[at] = sizes[i]; header[at + 1] = sizes[i];
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(bytes.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += bytes.length;
});
await writeFile('apps/web/app/favicon.ico', Buffer.concat([header, ...entries]));
const card = createCanvas(1200, 630), ctx = card.getContext('2d');
ctx.fillStyle = paper; ctx.fillRect(0, 0, 1200, 630);
ctx.fillStyle = '#E8E1F5'; ctx.beginPath(); ctx.arc(1110, 70, 285, 0, Math.PI * 2); ctx.fill();
ctx.drawImage(await loadImage(Buffer.from(mark)), 76, 64, 88, 88);
ctx.fillStyle = ink; ctx.font = 'bold 76px Arial'; ctx.fillText('ursly', 184, 133);
ctx.fillStyle = coral; ctx.fillText('.', 367, 133);
ctx.fillStyle = ink; ctx.font = 'bold 78px Georgia';
ctx.fillText('The joy of', 76, 294); ctx.fillText('understanding.', 76, 385);
ctx.font = '28px Arial'; ctx.fillText('Your sources. Your questions. A real conversation.', 80, 464);
ctx.font = 'bold 23px Arial'; ctx.fillText('ursly.io', 80, 557);
ctx.drawImage(await loadImage(Buffer.from(mark)), 906, 345, 180, 180);
await writeFile('apps/web/public/brand/social-card.png', card.toBuffer('image/png'));
console.log('Ursly brand assets generated.');
