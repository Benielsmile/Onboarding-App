import fs from 'node:fs';
import zlib from 'node:zlib';

function createSolidPNG(width, height, r, g, b, a = 255) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + RGBA pixels
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Draw PIGA emblem pattern: Black background, central red square/triangle
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);

      const isCenter = dx < width * 0.35 && dy < height * 0.35;
      const isRedAccent = (dx < width * 0.22 && dy < height * 0.22) || (y > height * 0.4 && y < height * 0.7 && x > width * 0.4);

      if (isRedAccent) {
        rawData[pixelOffset] = 0xE5; // R
        rawData[pixelOffset + 1] = 0x09; // G
        rawData[pixelOffset + 2] = 0x14; // B
        rawData[pixelOffset + 3] = 255;  // A
      } else if (isCenter && (dx > width * 0.28 || dy > height * 0.28)) {
        rawData[pixelOffset] = 0xFF; // White outline
        rawData[pixelOffset + 1] = 0xFF;
        rawData[pixelOffset + 2] = 0xFF;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 calculation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c >>> 0;
}

// Generate PWA icons
fs.writeFileSync('public/pwa-192x192.png', createSolidPNG(192, 192, 0, 0, 0));
fs.writeFileSync('public/pwa-512x512.png', createSolidPNG(512, 512, 0, 0, 0));
fs.writeFileSync('public/pwa-maskable-512x512.png', createSolidPNG(512, 512, 0, 0, 0));
fs.writeFileSync('public/apple-touch-icon.png', createSolidPNG(180, 180, 0, 0, 0));

console.log('PIGA STUDIO PWA icons generated successfully.');
