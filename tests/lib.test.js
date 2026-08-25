import { describe, it, expect } from 'vitest';
import {
  encU8, decU8, bytesToB64, b64ToBytes, b64Encode, b64Decode, b64urlDecode,
  jsonToYaml, yamlToJson,
  qrEncode, QR_MAX_BYTES,
  crc32,
  jsonToTsType, jsonToTs, jsonPathQuery, sortKeys,
  csvToJson, jsonToCsv,
  splitWords, slugify, toCamel, toPascal, toSnake, toKebab, toConstant, titleCase,
  diffLines, DIFF_LIMIT,
  parseColor, rgbToHsl, rgbToHex, hslToRgb,
  parseCronField, describeCron, cronNextRuns,
  estimateTokens,
  parseTimestamp,
  parseCurl, curlToFetch, curlToPython,
  printableRatio, detectPasteTypes,
  uuidV4, ulid, nanoid, randomHex, password,
} from '../lib.js';

describe('base64 / utf-8', () => {
  it('round-trips ASCII', () => {
    expect(b64Encode('hello')).toBe('aGVsbG8=');
    expect(b64Decode('aGVsbG8=')).toBe('hello');
  });
  it('round-trips UTF-8 (emoji, accents)', () => {
    const s = 'héllo — 世界 🚀';
    expect(b64Decode(b64Encode(s))).toBe(s);
  });
  it('bytesToB64 / b64ToBytes are inverse', () => {
    const bytes = encU8('data');
    expect(decU8(b64ToBytes(bytesToB64(bytes)))).toBe('data');
  });
  it('b64urlDecode handles url-safe alphabet and missing padding', () => {
    const header = b64urlDecode('eyJhbGciOiJIUzI1NiJ9'); // {"alg":"HS256"}
    expect(JSON.parse(header).alg).toBe('HS256');
  });
});

describe('JSON <-> YAML', () => {
  const cases = [
    { name: 'ada', age: 36, tags: ['x', 'y'], nested: { a: 1, b: [{ k: 'v' }] }, empty: [], obj: {} },
    { list: [1, 2, 3], flag: true, nil: null, s: 'has: colon' },
    [1, 'two', { three: 3 }],
  ];
  it('round-trips through YAML', () => {
    for (const value of cases) {
      const yaml = jsonToYaml(value);
      expect(yamlToJson(yaml)).toEqual(value);
    }
  });
  it('emits empty collections as flow style', () => {
    expect(jsonToYaml({ a: [] })).toContain('a: []');
    expect(jsonToYaml({ a: {} })).toContain('a: {}');
  });
  it('quotes strings that would otherwise parse as other types', () => {
    expect(yamlToJson(jsonToYaml({ v: 'true' })).v).toBe('true');
    expect(yamlToJson(jsonToYaml({ v: '123' })).v).toBe('123');
  });
});

describe('QR encoder', () => {
  it('selects the smallest version that fits', () => {
    expect(qrEncode('a').version).toBe(1);
    expect(qrEncode('a').size).toBe(21);
    expect(qrEncode('x'.repeat(200)).version).toBe(10);
    expect(qrEncode('x'.repeat(200)).size).toBe(57);
  });
  it('places the three finder patterns correctly', () => {
    const { matrix, size } = qrEncode('HELLO');
    // Dark border corner, white inner ring, dark 3x3 core.
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(0);
    expect(matrix[3][3]).toBe(1);
    // Separator row is light.
    expect(matrix[7][0]).toBe(0);
    // Finders exist in all three corners.
    expect(matrix[0][size - 1]).toBe(1);
    expect(matrix[size - 1][0]).toBe(1);
  });
  it('is a square matrix of 0/1', () => {
    const { matrix, size } = qrEncode('test');
    expect(matrix.length).toBe(size);
    for (const row of matrix) {
      expect(row.length).toBe(size);
      for (const cell of row) expect(cell === 0 || cell === 1).toBe(true);
    }
  });
  it('is deterministic', () => {
    expect(qrEncode('deterministic')).toEqual(qrEncode('deterministic'));
  });
  it('throws when the text exceeds capacity', () => {
    expect(() => qrEncode('x'.repeat(QR_MAX_BYTES + 50))).toThrow(/too long/i);
  });
});

describe('crc32', () => {
  it('matches known check vectors', () => {
    expect(crc32('')).toBe('00000000');
    expect(crc32('hello')).toBe('3610a686');
    expect(crc32('123456789')).toBe('cbf43926');
  });
});

describe('JSON tools', () => {
  it('infers TypeScript types', () => {
    const ts = jsonToTs({ id: 1, name: 'a', tags: ['x'], meta: { ok: true } });
    expect(ts).toContain('type Root = {');
    expect(ts).toContain('id: number;');
    expect(ts).toContain('tags: string[];');
    expect(ts).toContain('meta: {');
  });
  it('types empty and mixed arrays', () => {
    expect(jsonToTsType([])).toBe('unknown[]');
    expect(jsonToTsType([1, 'a'])).toBe('(number | string)[]');
  });
  it('queries by dot and bracket path', () => {
    const v = { a: { b: [{ c: 42 }] } };
    expect(jsonPathQuery(v, 'a.b.0.c')).toBe(42);
    expect(jsonPathQuery(v, 'a.b[0].c')).toBe(42);
    expect(jsonPathQuery(v, 'a.missing.x')).toBeUndefined();
  });
  it('sorts object keys recursively', () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: { d: 1, c: 2 } }))).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
});

describe('CSV <-> JSON', () => {
  it('parses CSV with quoted commas', () => {
    const rows = csvToJson('name,age\nAda,36\n"Bob, Jr",40');
    expect(rows).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Bob, Jr', age: '40' },
    ]);
  });
  it('serializes JSON to CSV, escaping as needed', () => {
    const csv = jsonToCsv([{ a: 'x', b: 'has,comma' }, { a: 'y' }]);
    expect(csv).toBe('a,b\nx,"has,comma"\ny,');
  });
  it('throws when JSON is not an array', () => {
    expect(() => jsonToCsv('{"a":1}')).toThrow();
  });
});

describe('text transforms', () => {
  it('splits words from mixed casing/separators', () => {
    expect(splitWords('helloWorld foo_bar-baz')).toEqual(['hello', 'World', 'foo', 'bar', 'baz']);
  });
  it('produces case styles', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(toCamel('hello world')).toBe('helloWorld');
    expect(toPascal('hello world')).toBe('HelloWorld');
    expect(toSnake('hello world')).toBe('hello_world');
    expect(toKebab('Hello World')).toBe('hello-world');
    expect(toConstant('hello world')).toBe('HELLO_WORLD');
    expect(titleCase('the quick brown fox')).toBe('The Quick Brown Fox');
  });
});

describe('diffLines', () => {
  it('marks context, deletions and additions', () => {
    const d = diffLines('a\nb\nc', 'a\nx\nc');
    expect(d).toEqual([
      { t: ' ', line: 'a' },
      { t: '-', line: 'b' },
      { t: '+', line: 'x' },
      { t: ' ', line: 'c' },
    ]);
  });
  it('throws above the size limit', () => {
    const big = 'x\n'.repeat(Math.ceil(Math.sqrt(DIFF_LIMIT)) + 10);
    expect(() => diffLines(big, big + 'y')).toThrow(/too large/i);
  });
});

describe('colours', () => {
  it('parses hex (3 and 6), rgb', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#7c9cff')).toEqual({ r: 124, g: 156, b: 255 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColor('rgb(1 2 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColor('nonsense')).toBeNull();
  });
  it('converts rgb to hsl and hex', () => {
    expect(rgbToHex({ r: 124, g: 156, b: 255 })).toBe('#7c9cff');
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });
  it('clamps out-of-range rgb instead of producing malformed hex', () => {
    expect(parseColor('rgb(300, -5, 128)')).toEqual({ r: 255, g: 0, b: 128 });
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080');
  });
  it('parses hsl() input (the tool advertises hex, rgb or hsl)', () => {
    const c = parseColor('hsl(225, 100%, 74%)');
    expect(c.b).toBe(255);
    expect(Math.abs(c.g - 156)).toBeLessThanOrEqual(2);
    expect(Math.abs(c.r - 124)).toBeLessThanOrEqual(4);
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('hslToRgb wraps hue and clamps s/l', () => {
    expect(hslToRgb({ h: 360, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: 0, s: 200, l: 150 })).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('cron', () => {
  it('parses fields into value sets', () => {
    expect([...parseCronField('*/15', 0, 59)]).toEqual([0, 15, 30, 45]);
    expect([...parseCronField('1-3', 0, 59)]).toEqual([1, 2, 3]);
    expect([...parseCronField('5', 0, 59)]).toEqual([5]);
    expect(() => parseCronField('bad', 0, 59)).toThrow();
  });
  it('treats a/b as start-at-a step-b up to max (not just {a})', () => {
    expect([...parseCronField('5/10', 0, 59)]).toEqual([5, 15, 25, 35, 45, 55]);
    expect([...parseCronField('5-30/10', 0, 59)]).toEqual([5, 15, 25]);
  });
  it('rejects out-of-range and inverted fields', () => {
    expect(() => parseCronField('99', 0, 59)).toThrow(/out of range/);
    expect(() => parseCronField('5-70', 0, 59)).toThrow(/out of range/);
    expect(() => parseCronField('30-10', 0, 59)).toThrow(/out of range/);
  });
  it('describes an expression', () => {
    expect(describeCron('*/5 9 * * 1'.split(' '))).toContain('minute [*/5]');
  });
  it('computes the next runs from a fixed instant', () => {
    const from = new Date('2025-01-01T10:07:00Z');
    const runs = cronNextRuns('*/15 * * * *', from, 3);
    expect(runs).toHaveLength(3);
    expect(runs[0].getTime()).toBeGreaterThan(from.getTime());
    // 15-minute spacing
    expect(runs[1].getTime() - runs[0].getTime()).toBe(15 * 60 * 1000);
  });
  it('rejects malformed expressions', () => {
    expect(() => cronNextRuns('* * *', new Date(), 1)).toThrow(/5 fields/);
  });
});

describe('estimateTokens', () => {
  it('reports chars, words and an approximate token count', () => {
    const { chars, words, tokens } = estimateTokens('the quick brown fox');
    expect(chars).toBe(19);
    expect(words).toBe(4);
    expect(tokens).toBeGreaterThan(0);
  });
  it('handles empty input', () => {
    expect(estimateTokens('')).toEqual({ chars: 0, words: 0, tokens: 0 });
  });
});

describe('parseTimestamp', () => {
  it('returns null for empty input', () => {
    expect(parseTimestamp('')).toBeNull();
  });
  it('returns an invalid date for non-numeric input', () => {
    expect(Number.isNaN(parseTimestamp('abc').getTime())).toBe(true);
  });
  it('treats small magnitudes as seconds and large as milliseconds', () => {
    expect(parseTimestamp('0').getTime()).toBe(0);
    expect(parseTimestamp('1700000000').getTime()).toBe(1700000000 * 1000);
    expect(parseTimestamp('1700000000000').getTime()).toBe(1700000000000);
  });
});

describe('curl -> code', () => {
  const cmd = "curl -X POST https://api.example.com/v1 -H 'Authorization: Bearer x' -d '{\"a\":1}'";
  it('parses method, url, headers and body', () => {
    const o = parseCurl(cmd);
    expect(o.method).toBe('POST');
    expect(o.url).toBe('https://api.example.com/v1');
    expect(o.headers.Authorization).toBe('Bearer x');
    expect(o.data).toBe('{"a":1}');
  });
  it('defaults to GET without a body and POST with one', () => {
    expect(parseCurl('curl https://x.com').method).toBe('GET');
    expect(parseCurl("curl https://x.com -d 'a=1'").method).toBe('POST');
  });
  it('emits fetch and python snippets', () => {
    const o = parseCurl(cmd);
    expect(curlToFetch(o)).toContain('await fetch("https://api.example.com/v1"');
    expect(curlToPython(o)).toContain('requests.request("POST"');
  });
});

describe('Smart Paste detection', () => {
  it('detects JSON', () => {
    const found = detectPasteTypes('{"a":1}');
    expect(found.some((f) => f.id === 'json')).toBe(true);
  });
  it('detects a UUID', () => {
    const found = detectPasteTypes('550e8400-e29b-41d4-a716-446655440000');
    expect(found.some((f) => f.id === 'id')).toBe(true);
  });
  it('detects modern UUID v7', () => {
    const found = detectPasteTypes('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
    expect(found.some((f) => f.id === 'id' && f.badge === 'v7')).toBe(true);
  });
  it('detects a hex colour', () => {
    const found = detectPasteTypes('#7c9cff');
    expect(found.some((f) => f.id === 'color')).toBe(true);
  });
  it('detects a unix timestamp', () => {
    const found = detectPasteTypes('1700000000');
    expect(found.some((f) => f.id === 'time')).toBe(true);
  });
  it('returns nothing for empty input', () => {
    expect(detectPasteTypes('')).toEqual([]);
  });
  it('printableRatio is 1 for plain text and lower for binary', () => {
    expect(printableRatio('hello')).toBe(1);
    expect(printableRatio('\x00\x01\x02hi')).toBeLessThan(1);
  });
});

describe('ID & random generators', () => {
  it('uuidV4 matches the v4 format', () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
  it('ulid is 26 Crockford base32 chars', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
  it('nanoid and hex and password have the right lengths', () => {
    expect(nanoid()).toHaveLength(21);
    expect(nanoid(10)).toHaveLength(10);
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(password(20)).toHaveLength(20);
  });
  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uuidV4()));
    expect(ids.size).toBe(50);
  });
});
