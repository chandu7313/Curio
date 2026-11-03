import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC32
    let crc = 0xffffffff;
    for (let i = 4; i < 8 + len; i++) {
      const byte = buf[i];
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Precompute CRC table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  // Raw image data with scanline filter 0
  const rowLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowLength);

  const radius = width / 2;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius - 0.5) {
        // Inner circle with teal gradient (#0d9488 to #14b8a6)
        const t = (x + y) / (width + height);
        rawData[pxOffset] = Math.round(13 + t * 7);      // R
        rawData[pxOffset + 1] = Math.round(148 + t * 36); // G
        rawData[pxOffset + 2] = Math.round(136 + t * 30); // B
        rawData[pxOffset + 3] = 255;                      // Alpha
      } else if (dist <= radius) {
        // Anti-aliased border
        const alpha = Math.round(255 * (radius - dist));
        rawData[pxOffset] = 13;
        rawData[pxOffset + 1] = 148;
        rawData[pxOffset + 2] = 136;
        rawData[pxOffset + 3] = alpha;
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'icon-16.png'), createPNG(16, 16));
fs.writeFileSync(path.join(outDir, 'icon-48.png'), createPNG(48, 48));
fs.writeFileSync(path.join(outDir, 'icon-128.png'), createPNG(128, 128));

console.log('Icons generated successfully in public/icons/');

