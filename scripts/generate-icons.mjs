import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
// Rasterize the simple brand glyph directly; no external image service is needed.
const points = [
  [36, 10],
  [16, 36],
  [31, 36],
  [28, 54],
  [49, 26],
  [34, 26],
];
function inside(x, y) {
  let c = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    if (
      points[i][1] > y !== points[j][1] > y &&
      x <
        ((points[j][0] - points[i][0]) * (y - points[i][1])) /
          (points[j][1] - points[i][1]) +
          points[i][0]
    )
      c = !c;
  return c;
}
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(b) {
  let c = 0xffffffff;
  for (const n of b) c = table[(c ^ n) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const t = Buffer.from(type),
    b = Buffer.alloc(12 + body.length);
  b.writeUInt32BE(body.length);
  t.copy(b, 4);
  body.copy(b, 8);
  b.writeUInt32BE(crc(Buffer.concat([t, body])), 8 + body.length);
  return b;
}
mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const data = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const p = y * (size * 3 + 1) + 1 + x * 3;
      const hit = inside(
        ((x / size) * 64 - 32) / 0.78 + 32,
        ((y / size) * 64 - 32) / 0.78 + 32,
      );
      data[p] = hit ? 39 : 200;
      data[p + 1] = hit ? 22 : 163;
      data[p + 2] = hit ? 53 : 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  writeFileSync(
    `public/icons/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(data)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
