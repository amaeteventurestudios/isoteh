// Makes simple PNG images with no image library: a background, bands of colour and blocky text. Used by the tests and
// the demo data, so the repository carries no image files.
import { deflateSync, crc32 } from 'node:zlib';

const FONT = { // 3x5 pixel letters
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', ' ': '000000000000000', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111',
  '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '%': '101001010100101', '!': '010010010000010', '.': '000000000000010', '-': '000000111000000', '+': '000010111010000',
};

/** width, height, background [r,g,b], lines: [{ text, color: [r,g,b], scale, y }], band: { color, y, h } */
export function png(width, height, { bg = [240, 236, 228], band, lines = [] } = {}) {
  const px = Buffer.alloc(width * height * 3);
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= width || y >= height) return; const i = (y * width + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, bg);
  if (band) for (let y = band.y; y < band.y + band.h; y++) for (let x = 0; x < width; x++) set(x, y, band.color);
  for (const l of lines) {
    const s = l.scale ?? 4, text = String(l.text).toUpperCase();
    const tw = text.length * 4 * s - s;
    let x0 = l.x ?? Math.round((width - tw) / 2);
    for (const ch of text) {
      const g = FONT[ch] ?? FONT[' '];
      for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (g[gy * 3 + gx] === '1')
        for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) set(x0 + gx * s + dx, l.y + gy * s + dy, l.color);
      x0 += 4 * s;
    }
  }
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; px.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
