// lib.js — pure, DOM-free logic for tools.vanshul.com.
// Single source of truth shared by index.html (UI) and the test suite.
// Everything here is deterministic and side-effect-free except the ID
// generators, which read from the platform CSPRNG (globalThis.crypto).

/* ------------------------------------------------------------------ *
 * UTF-8  <->  bytes  <->  base64
 * ------------------------------------------------------------------ */
export const encU8 = (str) => new TextEncoder().encode(str);
export const decU8 = (bytes) => new TextDecoder().decode(bytes);

export function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const b64Encode = (str) => bytesToB64(encU8(str));
export const b64Decode = (b64) => decU8(b64ToBytes(b64.trim()));

// base64url -> string (used by the JWT decoder). Throws on malformed input.
export function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return decU8(b64ToBytes(t));
}

/* ------------------------------------------------------------------ *
 * Base32 (RFC 4648, padded)
 * ------------------------------------------------------------------ */
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(input) {
  const bytes = typeof input === 'string' ? encU8(input) : Uint8Array.from(input);
  let out = '', value = 0, bits = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

export function base32Decode(text) {
  const clean = String(text ?? '').replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
  const out = [];
  let value = 0, bits = 0;
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid Base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export const base32EncodeText = (s) => base32Encode(String(s ?? ''));
export const base32DecodeText = (s) => decU8(base32Decode(s));

/* ------------------------------------------------------------------ *
 * URL query strings
 * ------------------------------------------------------------------ */
// Parse a full URL or a bare query string into decoded [key, value] pairs.
export function parseQuery(input) {
  let s = String(input).trim();
  const fi = s.indexOf('#'); if (fi >= 0) s = s.slice(0, fi); // drop fragment
  const qi = s.indexOf('?');
  if (qi >= 0) s = s.slice(qi + 1); // take the query part of a full URL
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return []; // full URL with no query
  if (s === '') return [];
  const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch { return x; } };
  return s.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    return eq < 0 ? [dec(pair), ''] : [dec(pair.slice(0, eq)), dec(pair.slice(eq + 1))];
  });
}
// Rebuild an encoded query string from [key, value] pairs.
export function buildQuery(pairs) {
  return pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

/* ------------------------------------------------------------------ *
 * JSON  <->  YAML  (block style; parser handles the common subset)
 * ------------------------------------------------------------------ */
export function jsonToYaml(value) {
  const q = (s) => {
    if (s === '') return '""';
    if (/^[\s>|@`"'%#&*!?{}\[\],]/.test(s) || /:(\s|$)/.test(s) || /\s#/.test(s) ||
      /^(true|false|null|~|yes|no|on|off)$/i.test(s) || (/^[+-]?(\d|\.\d)/.test(s) && !isNaN(Number(s))))
      return JSON.stringify(s);
    return s;
  };
  const scalar = (v) => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return '[]';
    if (typeof v === 'object') return '{}';
    return typeof v === 'string' ? q(v) : String(v);
  };
  const lines = [];
  const walk = (v, ind) => {
    const pad = '  '.repeat(ind);
    if (Array.isArray(v)) {
      if (!v.length) { lines.push(pad + '[]'); return; }
      for (const it of v) {
        if (it !== null && typeof it === 'object' && (Array.isArray(it) ? it.length : Object.keys(it).length)) { lines.push(pad + '-'); walk(it, ind + 1); }
        else lines.push(pad + '- ' + scalar(it));
      }
    } else if (v !== null && typeof v === 'object') {
      const ks = Object.keys(v);
      if (!ks.length) { lines.push(pad + '{}'); return; }
      for (const k of ks) {
        const val = v[k];
        if (val !== null && typeof val === 'object' && (Array.isArray(val) ? val.length : Object.keys(val).length)) { lines.push(pad + q(k) + ':'); walk(val, ind + 1); }
        else lines.push(pad + q(k) + ': ' + scalar(val));
      }
    } else lines.push(pad + scalar(v));
  };
  walk(value, 0);
  return lines.join('\n');
}

export function yamlToJson(text) {
  const lines = text.replace(/\t/g, '  ').split('\n').map((l) => l.replace(/\s+#.*$/, '')).filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  // Split a flow body on top-level commas, respecting nested [] {} and quotes.
  const splitFlow = (body) => {
    const parts = []; let depth = 0, q = null, cur = '';
    for (const c of body) {
      if (q) { cur += c; if (c === q) q = null; }
      else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === '[' || c === '{') { depth++; cur += c; }
      else if (c === ']' || c === '}') { depth--; cur += c; }
      else if (c === ',' && depth === 0) { parts.push(cur); cur = ''; }
      else cur += c;
    }
    if (cur.trim() !== '' || parts.length) parts.push(cur);
    return parts.map((p) => p.trim()).filter((p) => p !== '');
  };
  const scalar = (s) => {
    s = s.trim();
    if (s === '' || s === '~' || s === 'null') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s[0] === '"' && s.endsWith('"')) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
    if (s[0] === "'" && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
    // Inline flow seq/map — parse recursively so *unquoted* values work (JSON.parse can't).
    if (s[0] === '[' && s.endsWith(']')) return splitFlow(s.slice(1, -1)).map(scalar);
    if (s[0] === '{' && s.endsWith('}')) {
      const obj = {};
      for (const pair of splitFlow(s.slice(1, -1))) {
        const ci = pair.indexOf(':'); if (ci < 0) continue;
        obj[String(scalar(pair.slice(0, ci)))] = scalar(pair.slice(ci + 1));
      }
      return obj;
    }
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s);
    return s;
  };
  const parse = (min) => {
    const first = lines[i];
    if (!first.trim().startsWith('- ') && first.trim() !== '-' && first.indexOf(':') < 0) { i++; return scalar(first.trim()); }
    if (first.trim().startsWith('- ') || first.trim() === '-') {
      const arr = [];
      while (i < lines.length) {
        const l = lines[i], ind = indentOf(l), t = l.trim();
        if (ind < min || !(t === '-' || t.startsWith('- '))) break;
        const rest = t === '-' ? '' : t.slice(2); i++;
        if (rest === '') arr.push(i < lines.length && indentOf(lines[i]) > ind ? parse(ind + 1) : null);
        else if (/^[^:\n]+:(\s|$)/.test(rest)) { lines[i - 1] = ' '.repeat(ind + 2) + rest; i--; arr.push(parse(ind + 2)); }
        else arr.push(scalar(rest));
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length) {
      const l = lines[i], ind = indentOf(l), t = l.trim();
      if (ind < min || t.startsWith('- ')) break;
      const ci = t.indexOf(':'); if (ci < 0) { i++; continue; }
      const key = t.slice(0, ci).trim().replace(/^["']|["']$/g, ''); const val = t.slice(ci + 1).trim(); i++;
      obj[key] = val === '' ? (i < lines.length && indentOf(lines[i]) > ind ? parse(ind + 1) : null) : scalar(val);
    }
    return obj;
  };
  return lines.length ? parse(0) : null;
}

/* ------------------------------------------------------------------ *
 * QR encoder (byte mode, ECC level M, versions 1-10)
 * ------------------------------------------------------------------ */
const QR_EXP = new Array(512), QR_LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { QR_EXP[i] = x; QR_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
const qrMul = (a, b) => (a === 0 || b === 0) ? 0 : QR_EXP[QR_LOG[a] + QR_LOG[b]];
const qrGenPoly = (deg) => {
  let p = [1];
  for (let i = 0; i < deg; i++) { const np = new Array(p.length + 1).fill(0); for (let j = 0; j < p.length; j++) { np[j] ^= qrMul(p[j], QR_EXP[i]); np[j + 1] ^= p[j]; } p = np; }
  return p;
};
const qrRs = (data, ecLen) => {
  const gen = qrGenPoly(ecLen).reverse(), res = new Array(ecLen).fill(0);
  for (const d of data) { const f = d ^ res[0]; res.shift(); res.push(0); if (f !== 0) for (let i = 0; i < ecLen; i++) res[i] ^= qrMul(gen[i + 1], f); }
  return res;
};
const QR_M = { 1: [16, 10, [[1, 16]]], 2: [28, 16, [[1, 28]]], 3: [44, 26, [[1, 44]]], 4: [64, 18, [[2, 32]]], 5: [86, 24, [[2, 43]]], 6: [108, 16, [[4, 27]]], 7: [124, 18, [[4, 31]]], 8: [154, 22, [[2, 38], [2, 39]]], 9: [182, 22, [[3, 36], [2, 37]]], 10: [216, 26, [[4, 43], [1, 44]]] };
const QR_ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const QR_FMT = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];
const QR_VER = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };
export const QR_MAX_BYTES = QR_M[10][0] - 3;

// Returns { matrix: number[][] (1=dark), size, version }. Throws if too long.
export function qrEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) { const cc = v >= 10 ? 16 : 8; if (4 + cc + 8 * bytes.length <= QR_M[v][0] * 8) { version = v; break; } }
  if (!version) throw new Error('Text too long — max ~' + QR_MAX_BYTES + ' bytes at this quality.');
  const [dataCW, ecLen, blocks] = QR_M[version], cc = version >= 10 ? 16 : 8, size = 17 + 4 * version;
  const bits = []; const put = (val, len) => { for (let b = len - 1; b >= 0; b--) bits.push((val >> b) & 1); };
  put(4, 4); put(bytes.length, cc); for (const b of bytes) put(b, 8);
  const cap = dataCW * 8; for (let k = 0; k < 4 && bits.length < cap; k++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  for (let pi = 0; bits.length < cap; pi++) put(pi % 2 ? 0x11 : 0xEC, 8);
  const dcw = []; for (let k = 0; k < bits.length; k += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[k + j]; dcw.push(b); }
  const dBlocks = [], eBlocks = []; let p = 0;
  for (const [count, per] of blocks) for (let c = 0; c < count; c++) { const blk = dcw.slice(p, p + per); p += per; dBlocks.push(blk); eBlocks.push(qrRs(blk, ecLen)); }
  const stream = []; const maxD = Math.max(...dBlocks.map((b) => b.length));
  for (let k = 0; k < maxD; k++) for (const b of dBlocks) if (k < b.length) stream.push(b[k]);
  for (let k = 0; k < ecLen; k++) for (const b of eBlocks) stream.push(b[k]);
  const dataBits = []; for (const cwv of stream) for (let b = 7; b >= 0; b--) dataBits.push((cwv >> b) & 1);
  const mat = Array.from({ length: size }, () => new Array(size).fill(0));
  const res = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (r, c, v) => { if (r < 0 || c < 0 || r >= size || c >= size) return; mat[r][c] = v ? 1 : 0; res[r][c] = true; };
  const finder = (r, c) => { for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) { const ring = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6), core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4; setF(r + dr, c + dc, ring || core); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let k = 8; k < size - 8; k++) { if (!res[6][k]) setF(6, k, k % 2 === 0); if (!res[k][6]) setF(k, 6, k % 2 === 0); }
  const ap = QR_ALIGN[version];
  for (const r of ap) for (const c of ap) {
    if ((r <= 7 && c <= 7) || (r <= 7 && c >= size - 8) || (r >= size - 8 && c <= 7)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) setF(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  setF(size - 8, 8, true);
  for (let k = 0; k < 9; k++) { res[8][k] = true; res[k][8] = true; }
  for (let k = 0; k < 8; k++) { res[8][size - 1 - k] = true; res[size - 1 - k][8] = true; }
  if (version >= 7) for (let a = 0; a < 6; a++) for (let b = 0; b < 3; b++) { res[size - 11 + b][a] = true; res[a][size - 11 + b] = true; }
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const col = right - j, up = ((right + 1) & 2) === 0, row = up ? size - 1 - vert : vert; if (!res[row][col]) mat[row][col] = idx < dataBits.length ? dataBits[idx++] : 0; }
  }
  const maskFn = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (((r >> 1) + Math.floor(c / 3)) % 2) === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) === 0, (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0, (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0];
  const placeFmt = (m, mask) => {
    const f = QR_FMT[mask], gb = (i) => (f >> i) & 1;
    for (let i = 0; i <= 5; i++) m[i][8] = gb(i);
    m[7][8] = gb(6); m[8][8] = gb(7); m[8][7] = gb(8);
    for (let i = 9; i < 15; i++) m[8][14 - i] = gb(i);
    for (let i = 0; i < 8; i++) m[8][size - 1 - i] = gb(i);
    for (let i = 8; i < 15; i++) m[size - 15 + i][8] = gb(i);
    m[size - 8][8] = 1;
    if (version >= 7) { const vf = QR_VER[version]; for (let i = 0; i < 18; i++) { const bit = (vf >> i) & 1, a = Math.floor(i / 3), b = i % 3; m[size - 11 + b][a] = bit; m[a][size - 11 + b] = bit; } }
  };
  const apply = (mask) => { const m = mat.map((r) => r.slice()); for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!res[r][c] && maskFn[mask](r, c)) m[r][c] ^= 1; placeFmt(m, mask); return m; };
  const penalty = (m) => {
    let s = 0;
    for (let r = 0; r < size; r++) { let run = 1; for (let c = 1; c < size; c++) { if (m[r][c] === m[r][c - 1]) { if (++run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
    for (let c = 0; c < size; c++) { let run = 1; for (let r = 1; r < size; r++) { if (m[r][c] === m[r - 1][c]) { if (++run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) { const v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) s += 3; }
    let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
    s += Math.floor(Math.abs(dark / (size * size) * 100 - 50) / 5) * 10;
    return s;
  };
  let best = null, bp = Infinity;
  for (let mask = 0; mask < 8; mask++) { const m = apply(mask), pen = penalty(m); if (pen < bp) { bp = pen; best = m; } }
  return { matrix: best, size, version };
}

/* ------------------------------------------------------------------ *
 * Checksums
 * ------------------------------------------------------------------ */
export function crc32(str) {
  const data = new TextEncoder().encode(str);
  let c = ~0;
  for (let i = 0; i < data.length; i++) { c ^= data[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ((~c) >>> 0).toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ *
 * JSON tools: TypeScript types, path query, sort keys
 * ------------------------------------------------------------------ */
export function jsonToTsType(x) {
  if (x === null) return 'null';
  if (Array.isArray(x)) { if (!x.length) return 'unknown[]'; const ts = [...new Set(x.map(jsonToTsType))]; return (ts.length === 1 ? ts[0] : '(' + ts.join(' | ') + ')') + '[]'; }
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') { const body = Object.entries(x).map(([k, v]) => `  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsonToTsType(v).replace(/\n/g, '\n  ')};`).join('\n'); return `{\n${body}\n}`; }
  return 'unknown';
}
export const jsonToTs = (value) => 'type Root = ' + jsonToTsType(value) + ';';

export function jsonPathQuery(v, path) {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').map((s) => s.trim()).filter(Boolean);
  let cur = v;
  for (const k of keys) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

export function sortKeys(v) {
  return Array.isArray(v) ? v.map(sortKeys) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
}

/* ------------------------------------------------------------------ *
 * CSV  <->  JSON
 * ------------------------------------------------------------------ */
export function csvToJson(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => !(r.length === 1 && r[0] === '')).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function jsonToCsv(input) {
  const arr = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of objects');
  const cols = [...new Set(arr.flatMap((o) => Object.keys(o || {})))];
  const esc = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [cols.join(','), ...arr.map((o) => cols.map((c) => esc(o?.[c])).join(','))].join('\n');
}

/* ------------------------------------------------------------------ *
 * Text transforms
 * ------------------------------------------------------------------ */
export const splitWords = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-]+/).filter(Boolean);
export const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const toCamel = (s) => splitWords(s).map((x, i) => i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join('');
export const toPascal = (s) => splitWords(s).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('');
export const toSnake = (s) => splitWords(s).map((x) => x.toLowerCase()).join('_');
export const toKebab = (s) => splitWords(s).map((x) => x.toLowerCase()).join('-');
export const toConstant = (s) => splitWords(s).map((x) => x.toUpperCase()).join('_');
export const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

// Number-base conversion: supports signed integers in radix 2..36.
export function parseBaseNumber(value, base = 10) {
  const raw = String(value).trim();
  if (!raw) throw new Error('Empty input');
  let s = raw;
  const sign = s.startsWith('-') ? -1n : 1n;
  if (s.startsWith('+') || s.startsWith('-')) s = s.slice(1);
  if (/^0x/i.test(s)) { s = s.slice(2); base = 16; }
  else if (/^0b/i.test(s)) { s = s.slice(2); base = 2; }
  else if (/^0o/i.test(s)) { s = s.slice(2); base = 8; }
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error('Base must be between 2 and 36');
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let out = 0n;
  for (const ch of s) {
    const idx = digits.indexOf(ch.toLowerCase());
    if (idx === -1 || idx >= base) throw new Error(`Invalid digit for base ${base}: ${ch}`);
    out = out * BigInt(base) + BigInt(idx);
  }
  return sign * out;
}

export function formatBaseNumber(value, base = 10) {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error('Base must be between 2 and 36');
  const n = BigInt(value);
  if (n === 0n) return '0';
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const negative = n < 0n;
  let x = negative ? -n : n;
  let s = '';
  while (x > 0n) {
    const idx = Number(x % BigInt(base));
    s = digits[idx] + s;
    x /= BigInt(base);
  }
  return negative ? '-' + s : s;
}

export function convertBaseNumber(value, fromBase, toBase) {
  const n = parseBaseNumber(value, fromBase);
  return formatBaseNumber(n, toBase);
}

export function numberBaseInfo(value, fromBase = 10) {
  const n = parseBaseNumber(value, fromBase);
  return {
    decimal: formatBaseNumber(n, 10),
    binary: formatBaseNumber(n, 2),
    octal: formatBaseNumber(n, 8),
    hex: formatBaseNumber(n, 16),
    base36: formatBaseNumber(n, 36),
    signed: n.toString(),
  };
}

// Simple markdown-to-HTML renderer for a privacy-first browser tool.
export function markdownToHtml(input) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const inline = (s) => esc(s)
    .replace(/\[(.+?)\]\((https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+|\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = String(input || '').split(/\n/);
  const out = [];
  let listType = null;
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    out.push(listType === 'ol' ? '<ol>' + listItems.map((i) => '<li>' + inline(i) + '</li>').join('') + '</ol>' : '<ul>' + listItems.map((i) => '<li>' + inline(i) + '</li>').join('') + '</ul>');
    listItems = [];
    listType = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { flushList(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ul) { if (listType !== 'ul') { flushList(); listType = 'ul'; } listItems.push(ul[1]); continue; }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) { if (listType !== 'ol') { flushList(); listType = 'ol'; } listItems.push(ol[1]); continue; }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join('');
}

/* ------------------------------------------------------------------ *
 * Escaping helpers
 * ------------------------------------------------------------------ */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_UNESCAPES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

export function unescapeHtml(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    const named = HTML_UNESCAPES[body.toLowerCase()];
    return named === undefined ? full : named;
  });
}

// Escape a literal so it can be embedded in a regular expression.
export const escapeRegex = (s) => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Escape/unescape the contents of a JS/JSON double-quoted string literal.
export const escapeJsString = (s) => JSON.stringify(String(s ?? '')).slice(1, -1);

export function unescapeJsString(s) {
  const body = String(s ?? '').replace(/\\?"/g, '\\"');
  try {
    return JSON.parse(`"${body}"`);
  } catch {
    throw new Error('Not a valid escaped string');
  }
}

/* ------------------------------------------------------------------ *
 * Regex safety
 * ------------------------------------------------------------------ */
// Heuristic guard for catastrophic backtracking: flags a group that both
// contains an unbounded quantifier and is itself unboundedly quantified,
// e.g. (a+)+ or (\d*)*. A warning, not a proof of safety.
export function analyzeRegexRisk(pattern) {
  const src = String(pattern ?? '');
  const unboundedAt = (i) => {
    const c = src[i];
    if (c === '+' || c === '*') return true;
    if (c === '{') {
      const close = src.indexOf('}', i);
      return close > i && /^\{\d+,\}$/.test(src.slice(i, close + 1));
    }
    return false;
  };
  const stack = [];
  let escaped = false, inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; continue; }
    if (c === '(') { stack.push(false); continue; }
    if (c === ')') {
      const innerQuantified = stack.pop();
      if (innerQuantified && unboundedAt(i + 1)) {
        return { risky: true, reason: 'Nested unbounded quantifiers (e.g. (a+)+) can backtrack catastrophically.' };
      }
      continue;
    }
    if (unboundedAt(i) && stack.length) stack[stack.length - 1] = true;
  }
  return { risky: false, reason: '' };
}

export const REGEX_MATCH_LIMIT = 10_000;

// Bounded global scan: stops at a match cap or a wall-clock budget so a
// pathological pattern degrades into a partial result instead of a hang.
export function regexScan(pattern, flags, text, options = {}) {
  const { limit = REGEX_MATCH_LIMIT, timeBudgetMs = 250, now = Date.now } = options;
  const source = String(text ?? '');
  const f = String(flags ?? '');
  const re = new RegExp(pattern, f.includes('g') ? f : f + 'g');
  const matches = [];
  const started = now();
  let truncated = false, timedOut = false, m;
  while ((m = re.exec(source)) !== null) {
    matches.push({
      index: m.index,
      value: m[0],
      groups: m.slice(1),
      named: m.groups ? { ...m.groups } : null,
    });
    if (m[0] === '') re.lastIndex++;
    if (matches.length >= limit) { truncated = true; break; }
    if (matches.length % 64 === 0 && now() - started > timeBudgetMs) { timedOut = true; break; }
  }
  return { matches, truncated, timedOut };
}

// Line diff via LCS. Returns [{ t: ' '|'-'|'+', line }]. Throws if too large.
export const DIFF_LIMIT = 4_000_000;
export function diffLines(aText, bText) {
  const A = aText.split('\n'), B = bText.split('\n');
  const n = A.length, m = B.length;
  if (n * m > DIFF_LIMIT) throw new Error('Too large to diff — keep it under a few thousand lines per side.');
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: ' ', line: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: '-', line: A[i] }); i++; }
    else { out.push({ t: '+', line: B[j] }); j++; }
  }
  while (i < n) out.push({ t: '-', line: A[i++] });
  while (j < m) out.push({ t: '+', line: B[j++] });
  return out;
}

/* ------------------------------------------------------------------ *
 * Colours
 * ------------------------------------------------------------------ */
const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: clampByte((r + m0) * 255), g: clampByte((g + m0) * 255), b: clampByte((b + m0) * 255) };
}
export function parseColor(str) {
  str = str.trim();
  let m;
  if ((m = /^#?([0-9a-f]{3})$/i.exec(str))) { const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16)); return { r, g, b }; }
  if ((m = /^#?([0-9a-f]{6})$/i.exec(str))) { const i = parseInt(m[1], 16); return { r: (i >> 16) & 255, g: (i >> 8) & 255, b: i & 255 }; }
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(str))) { const [r, g, b] = m[1].trim().split(/[\s,\/]+/).map((x) => parseInt(x)); if ([r, g, b].some((n) => Number.isNaN(n))) return null; return { r: clampByte(r), g: clampByte(g), b: clampByte(b) }; }
  if ((m = /^hsla?\(([^)]+)\)$/i.exec(str))) { const [h, s, l] = m[1].trim().split(/[\s,\/]+/).map((x) => parseFloat(x)); if ([h, s, l].some((n) => Number.isNaN(n))) return null; return hslToRgb({ h, s, l }); }
  return null;
}
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
export const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((x) => clampByte(x).toString(16).padStart(2, '0')).join('');

/* ------------------------------------------------------------------ *
 * Cron
 * ------------------------------------------------------------------ */
export function parseCronField(f, min, max) {
  const set = new Set();
  for (const part of f.split(',')) {
    const [range, stepS] = part.split('/'); const step = stepS ? parseInt(stepS) : 1;
    let lo, hi;
    if (range === '*') { lo = min; hi = max; }
    else if (range.includes('-')) { const [a, b] = range.split('-').map(Number); lo = a; hi = b; }
    else { lo = parseInt(range); hi = stepS ? max : lo; } // "a/b" starts at a and steps to max
    if (Number.isNaN(lo) || Number.isNaN(hi) || Number.isNaN(step) || step < 1) throw new Error('Bad field: ' + f);
    if (lo < min || hi > max || lo > hi) throw new Error('Field out of range: ' + f);
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  return set;
}
export function describeCron(parts) {
  if (!Array.isArray(parts) || parts.length !== 5) return '';
  const [mi, ho, dom, mon, dow] = parts;
  const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const isNum = (s) => /^\d+$/.test(s);
  const rangeOf = (s) => { const m = /^(\d+)-(\d+)$/.exec(s); return m ? [m[1], m[2]] : null; };
  const miStep = /^\*\/(\d+)$/.exec(mi), hoRange = rangeOf(ho);
  let time;
  if (mi === '*' && ho === '*') time = 'Every minute';
  else if (miStep && ho === '*') time = `Every ${miStep[1]} minutes`;
  else if (miStep && hoRange) time = `Every ${miStep[1]} minutes, between ${pad2(hoRange[0])}:00 and ${pad2(hoRange[1])}:59`;
  else if (miStep && isNum(ho)) time = `Every ${miStep[1]} minutes during the ${pad2(ho)}:00 hour`;
  else if (isNum(mi) && ho === '*') time = `At minute ${mi} of every hour`;
  else if (isNum(mi) && isNum(ho)) time = `At ${pad2(ho)}:${pad2(mi)}`;
  else if (isNum(mi) && hoRange) time = `At minute ${mi}, between ${pad2(hoRange[0])}:00 and ${pad2(hoRange[1])}:00`;
  else if (mi === '*' && isNum(ho)) time = `Every minute during the ${pad2(ho)}:00 hour`;
  else time = `At minute ${mi}` + (ho === '*' ? '' : `, hour ${ho}`);
  const dowClause = (f) => { const r = rangeOf(f); if (r) return `${DAYS[+r[0] % 7]} to ${DAYS[+r[1] % 7]}`; return f.split(',').map((d) => isNum(d) ? DAYS[+d % 7] : d).join(', '); };
  const monClause = (f) => { const r = rangeOf(f); if (r) return `${MONTHS[+r[0]]} to ${MONTHS[+r[1]]}`; return f.split(',').map((d) => isNum(d) ? MONTHS[+d] : d).join(', '); };
  const clauses = [time];
  if (dom !== '*') clauses.push(isNum(dom) ? `on day ${dom} of the month` : `on day-of-month ${dom}`);
  if (dow !== '*') clauses.push(`on ${dowClause(dow)}`);
  if (mon !== '*') clauses.push(`in ${monClause(mon)}`);
  return clauses.join(', ') + '.';
}
// Returns up to `count` future run Dates. Throws on malformed expressions.
export function cronNextRuns(expr, from = new Date(), count = 6) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Need exactly 5 fields: minute hour day-of-month month day-of-week');
  const mins = parseCronField(parts[0], 0, 59), hrs = parseCronField(parts[1], 0, 23),
    doms = parseCronField(parts[2], 1, 31), mons = parseCronField(parts[3], 1, 12),
    dows = parseCronField(parts[4].replace(/\b7\b/g, '0'), 0, 6);
  const domStar = parts[2] === '*', dowStar = parts[4] === '*';
  const d = new Date(from); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  const runs = []; let guard = 0;
  while (runs.length < count && guard++ < 535680) {
    if (mons.has(d.getMonth() + 1) && hrs.has(d.getHours()) && mins.has(d.getMinutes())) {
      const dayOk = (domStar || dowStar) ? (doms.has(d.getDate()) && dows.has(d.getDay())) : (doms.has(d.getDate()) || dows.has(d.getDay()));
      if (dayOk) runs.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return runs;
}

/* ------------------------------------------------------------------ *
 * LLM token & cost estimate
 * ------------------------------------------------------------------ */
export const MODEL_PRICES = { 'GPT-4o': 2.5, 'GPT-4o mini': 0.15, 'o3': 2, 'Claude Opus': 15, 'Claude Sonnet': 3, 'Gemini 1.5 Pro': 1.25, 'Gemini Flash': 0.075 };
export function estimateTokens(text) {
  const chars = text.length;
  const words = (text.trim().match(/\S+/g) || []).length;
  const tokens = Math.round((chars / 4 + words / 0.75) / 2) || 0;
  return { chars, words, tokens };
}

/* ------------------------------------------------------------------ *
 * Timestamp parsing (magnitude-based s/ms detection)
 * ------------------------------------------------------------------ */
// Returns a Date, or null for empty input, or NaN-Date for malformed input.
export function parseTimestamp(raw) {
  raw = String(raw).trim();
  if (raw === '') return null;
  if (!/^-?\d+$/.test(raw)) return new Date(NaN);
  let v = Number(raw);
  if (Math.abs(v) < 1e11) v *= 1000; // small magnitudes are seconds, large are ms
  return new Date(v);
}

/* ------------------------------------------------------------------ *
 * cURL -> code
 * ------------------------------------------------------------------ */
function curlTokenize(s) {
  const t = []; let cur = '', q = null; s = s.replace(/\\\n/g, ' ');
  for (const c of s) {
    if (q) { if (c === q) q = null; else cur += c; }
    else if (c === '"' || c === "'") q = c;
    else if (/\s/.test(c)) { if (cur) { t.push(cur); cur = ''; } }
    else cur += c;
  }
  if (cur) t.push(cur);
  return t;
}
export function parseCurl(s) {
  const t = curlTokenize(s.trim()); const o = { method: null, url: null, headers: {}, data: null };
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    if (a === 'curl') continue;
    else if (a === '-X' || a === '--request') o.method = t[++i];
    else if (a === '-H' || a === '--header') { const h = t[++i] || ''; const ci = h.indexOf(':'); if (ci > 0) o.headers[h.slice(0, ci).trim()] = h.slice(ci + 1).trim(); }
    else if (a === '-d' || a === '--data' || a === '--data-raw' || a === '--data-binary') o.data = t[++i];
    else if (a === '-u' || a === '--user') o.headers['Authorization'] = 'Basic ' + btoa(t[++i] || '');
    else if (!a.startsWith('-') && /^https?:\/\//.test(a)) o.url = a;
  }
  if (!o.method) o.method = o.data != null ? 'POST' : 'GET';
  return o;
}
export function curlToFetch(o) {
  const opts = { method: o.method, headers: o.headers }; if (o.data != null) opts.body = o.data;
  return `const res = await fetch(${JSON.stringify(o.url)}, ${JSON.stringify(opts, null, 2)});\nconst data = await res.json();`;
}
export function curlToPython(o) {
  const pyDict = (h) => '{' + Object.entries(h).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ') + '}';
  return `import requests\nres = requests.request(${JSON.stringify(o.method)}, ${JSON.stringify(o.url)},\n    headers=${pyDict(o.headers)}${o.data != null ? `,\n    data=${JSON.stringify(o.data)}` : ''})\nprint(res.json())`;
}

/* ------------------------------------------------------------------ *
 * Smart Paste — pure classifier
 * Returns [{ id, label, badge, text, color? }] most-specific first.
 * ------------------------------------------------------------------ */
export function printableRatio(s) {
  if (!s) return 0;
  let p = 0;
  for (const ch of s) { const c = ch.codePointAt(0); if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || c > 127) p++; }
  return p / [...s].length;
}
export function detectPasteTypes(text) {
  const t = String(text).trim(); const found = [];
  if (!t) return found;
  // JWT
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(t)) {
    const dj = (x) => { try { return JSON.parse(b64urlDecode(x)); } catch { return null; } };
    const [h, p] = t.split('.'); const H = dj(h), P = dj(p);
    if (H && P) {
      const notes = [];
      if (P.exp) notes.push('expires ' + new Date(P.exp * 1000).toLocaleString() + (P.exp * 1000 < Date.now() ? ' (EXPIRED)' : ''));
      if (P.sub) notes.push('sub ' + P.sub);
      found.push({ id: 'jwt', label: 'JWT', badge: 'auth token', text: 'header  ' + JSON.stringify(H) + '\npayload ' + JSON.stringify(P) + (notes.length ? '\n' + notes.join(' · ') : '') });
    }
  }
  // JSON
  if (/^[\[{]/.test(t)) { try { const v = JSON.parse(t); found.push({ id: 'json', label: 'JSON', badge: 'data', text: JSON.stringify(v, null, 2) }); } catch { /* not json */ } }
  // URL-encoded
  if (/%[0-9A-Fa-f]{2}/.test(t)) { try { const d = decodeURIComponent(t); if (d !== t) found.push({ id: 'url', label: 'URL-decoded', badge: 'encoded', text: d }); } catch { /* malformed */ } }
  // Base64
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(t) && t.length >= 8 && t.length % 4 === 0) { let d = null; try { d = b64Decode(t); } catch { d = null; } if (d && d !== t && printableRatio(d) > 0.85) found.push({ id: 'base64', label: 'Base64-decoded', badge: 'encoded', text: d }); }
  // Hex colour
  if (/^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{3}$/.test(t)) { const h = t.replace('#', ''); const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h; const hex = '#' + full.toLowerCase(); const n = parseInt(full, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; found.push({ id: 'color', label: 'Colour', badge: hex, color: hex, text: `rgb(${r}, ${g}, ${b})` }); }
  // Unix timestamp
  if (/^\d{10}$/.test(t)) { const d = new Date(+t * 1000); found.push({ id: 'time', label: 'Unix timestamp (s)', badge: 'time', text: d.toString() + '\n' + d.toISOString() }); }
  else if (/^\d{13}$/.test(t)) { const d = new Date(+t); found.push({ id: 'time', label: 'Unix timestamp (ms)', badge: 'time', text: d.toString() + '\n' + d.toISOString() }); }
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) found.push({ id: 'id', label: 'UUID', badge: 'v' + t[14], text: 'Valid UUID — version ' + t[14] });
  // Hash digest by length
  const HLEN = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 128: 'SHA-512' };
  if (/^[0-9a-f]+$/i.test(t) && HLEN[t.length]) found.push({ id: 'hash', label: HLEN[t.length] + ' digest', badge: 'hash', text: 'Looks like a ' + HLEN[t.length] + ' hash (' + t.length + ' hex chars).' });
  // Integer -> radix conversions
  if (/^-?\d+$/.test(t) && t.length <= 15) { const n = parseInt(t, 10); if (!Number.isNaN(n)) found.push({ id: 'transform', label: 'Number', badge: 'radix', text: `hex 0x${(n >>> 0).toString(16)}   ·   oct 0o${(n >>> 0).toString(8)}   ·   bin 0b${(n >>> 0).toString(2)}` }); }
  return found;
}

/* ------------------------------------------------------------------ *
 * ID & random generators (use the platform CSPRNG)
 * ------------------------------------------------------------------ */
const randBytes = (n) => { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); return a; };
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NANO_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
const PW_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+';
export const uuidV4 = () => globalThis.crypto.randomUUID();
// UUIDv7: 48-bit big-endian Unix-ms timestamp + version/variant + random — time-sortable.
export function uuidV7(now = Date.now()) {
  const b = randBytes(16);
  b[0] = Math.floor(now / 2 ** 40) & 0xff;
  b[1] = Math.floor(now / 2 ** 32) & 0xff;
  b[2] = Math.floor(now / 2 ** 24) & 0xff;
  b[3] = Math.floor(now / 2 ** 16) & 0xff;
  b[4] = Math.floor(now / 2 ** 8) & 0xff;
  b[5] = now & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function ulid(now = Date.now()) {
  let t = now, time = '';
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  const r = randBytes(16); let s = '';
  for (let i = 0; i < 16; i++) s += CROCKFORD[r[i] & 31];
  return time + s;
}
export function nanoid(n = 21) { const r = randBytes(n); let s = ''; for (let i = 0; i < n; i++) s += NANO_ALPHABET[r[i] & 63]; return s; }
export function randomHex(n = 16) { return [...randBytes(n)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
export function password(n = 20) { const r = randBytes(n); let s = ''; for (let i = 0; i < n; i++) s += PW_ALPHABET[r[i] % PW_ALPHABET.length]; return s; }
