// Ad images. Only PNG, JPEG, WebP and GIF files are accepted, checked by their first bytes (never by name or the type the
// uploader claims). Each is stored once under its own hash and served from our own address with a fixed type, so an ad
// can never carry a script. There are no HTML ads.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { httpError } from './util.mjs';

export const MAX_IMAGE = 1_500_000;
export const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** The image's kind and pixel size from its header, or null when it isn't one we accept. */
export function sniff(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR')
    return { ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')
    return { ext: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && buf.length >= 30) return { ext: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && buf.length >= 25) { const b = buf.readUInt32LE(21); return { ext: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X' && buf.length >= 30) return { ext: 'webp', width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {   // JPEG: walk the markers to the frame header
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { ext: 'jpg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

export function makeCreatives(dir) {
  const root = join(dir, 'creatives');
  mkdirSync(root, { recursive: true });
  return {
    /** Store a base64 image; returns { file, width, height }. */
    save(b64) {
      const buf = Buffer.from(String(b64 ?? '').replace(/^data:[^,]*,/, ''), 'base64');
      if (!buf.length) throw httpError(400, 'Add an image');
      if (buf.length > MAX_IMAGE) throw httpError(413, 'Images must be under 1.5 MB');
      const kind = sniff(buf);
      if (!kind || !kind.width || !kind.height || kind.width > 4000 || kind.height > 4000) throw httpError(400, 'Use a PNG, JPEG, WebP or GIF image');
      const file = `${createHash('sha256').update(buf).digest('hex').slice(0, 32)}.${kind.ext}`;
      const path = join(root, file);
      if (!existsSync(path)) writeFileSync(path, buf);
      return { file, width: kind.width, height: kind.height };
    },
    /** The bytes and type of a stored image, or null. */
    read(file) {
      if (!/^[0-9a-f]{32}\.(png|jpg|webp|gif)$/.test(file ?? '')) return null;
      const path = join(root, file);
      return existsSync(path) ? { bytes: readFileSync(path), type: TYPES[file.split('.').pop()] } : null;
    },
  };
}
