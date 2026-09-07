import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
// Only asset regeneration needs ffmpeg; builds use the committed MP3 files.
execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
const scratch = mkdtempSync(join(tmpdir(), 'superfocus-audio-'));
mkdirSync('public/audio', { recursive: true });
const pieces = [
  ['quiet-orbit', 48, [0, 7, 12, 16], 8],
  ['first-light', 57, [0, 4, 7, 14], 6],
  ['deep-current', 41, [0, 7, 10, 14], 12],
  ['moon-room', 46, [0, 3, 7, 14], 10],
  ['still-water', 53, [0, 5, 7, 12], 8],
  ['paper-lantern', 60, [0, 4, 9, 14], 4],
  ['blue-hour', 43, [0, 7, 12, 15], 12],
  ['slow-morning', 50, [0, 4, 7, 11], 8],
  ['distant-stars', 55, [0, 7, 14, 19], 6],
  ['home-stretch', 48, [0, 5, 9, 12], 4],
];
const rate = 22050,
  seconds = 48,
  length = rate * seconds;
try {
  for (let index = 0; index < pieces.length; index++) {
    const [id, root, chord, step] = pieces[index];
    const buffer = Buffer.alloc(44 + length * 2);
    buffer.write('RIFF');
    buffer.writeUInt32LE(36 + length * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(length * 2, 40);
    for (let i = 0; i < length; i++) {
      const t = i / rate,
        fade = Math.min(1, t / 2, (seconds - t) / 2);
      let sample = 0;
      for (let n = 0; n < chord.length; n++) {
        const freq = 440 * Math.pow(2, (root + chord[n] - 69) / 12),
          swell = 0.65 + 0.35 * Math.sin((2 * Math.PI * t) / (12 + n * 4) + n);
        sample +=
          Math.sin(2 * Math.PI * freq * t + 0.06 * Math.sin(t * 0.4)) *
          swell *
          0.055;
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.012;
      }
      const noteIndex = Math.floor(t / step) % chord.length,
        age = t % step,
        note = 440 * Math.pow(2, (root + chord[noteIndex] + 12 - 69) / 12),
        env = (1 - Math.exp(-age * 7)) * Math.exp(-age / 1.8);
      sample +=
        (Math.sin(2 * Math.PI * note * t) +
          0.2 * Math.sin(2 * Math.PI * note * 2 * t)) *
        env *
        0.07;
      buffer.writeInt16LE(
        Math.round(Math.tanh(sample) * fade * 28000),
        44 + i * 2,
      );
    }
    const source = join(scratch, `${String(id)}.wav`);
    writeFileSync(source, buffer);
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      source,
      '-map_metadata',
      '-1',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      `public/audio/${String(id)}.mp3`,
    ]);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log(
  'Generated 10 original 48-second ambient compositions as compact MP3s.',
);
