import { describe, it, expect } from 'vitest';
import {
  encU8, decU8, bytesToB64, b64ToBytes, b64Encode, b64Decode, b64urlDecode,
  base32Encode, base32Decode, base32EncodeText, base32DecodeText,
  parseQuery, buildQuery,
  jsonToYaml, yamlToJson,
  qrEncode, QR_MAX_BYTES,
  crc32,
  jsonToTsType, jsonToTs, jsonPathQuery, sortKeys,
  csvToJson, jsonToCsv,
  splitWords, slugify, toCamel, toPascal, toSnake, toKebab, toConstant, titleCase,
  parseBaseNumber, formatBaseNumber, convertBaseNumber, numberBaseInfo,
  markdownToHtml,
  escapeHtml, unescapeHtml, escapeRegex, escapeJsString, unescapeJsString,
  analyzeRegexRisk, regexScan, REGEX_MATCH_LIMIT,
  sqlFormat, sqlTokenize, pythonFormat,
  diffLines, DIFF_LIMIT,
  parseColor, rgbToHsl, rgbToHex, hslToRgb,
  parseCronField, describeCron, cronNextRuns,
  estimateTokens,
  parseTimestamp,
  parseCurl, curlToFetch, curlToPython,
  printableRatio, detectPasteTypes,
  uuidV4, uuidV7, ulid, nanoid, randomHex, password,
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

describe('base32 (RFC 4648)', () => {
  const vectors = [
    ['', ''],
    ['f', 'MY======'],
    ['fo', 'MZXQ===='],
    ['foo', 'MZXW6==='],
    ['foob', 'MZXW6YQ='],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI======'],
  ];
  it('matches the RFC test vectors', () => {
    for (const [plain, encoded] of vectors) {
      expect(base32EncodeText(plain)).toBe(encoded);
      expect(base32DecodeText(encoded)).toBe(plain);
    }
  });
  it('round-trips UTF-8 and raw bytes', () => {
    const s = 'h\u00e9llo \u4e16\u754c \ud83d\ude80';
    expect(base32DecodeText(base32EncodeText(s))).toBe(s);
    expect([...base32Decode(base32Encode(new Uint8Array([0, 255, 128])))]).toEqual([0, 255, 128]);
  });
  it('ignores whitespace and is case-insensitive on decode', () => {
    expect(base32DecodeText('mzxw6 ytb oi======')).toBe('foobar');
  });
  it('rejects characters outside the alphabet', () => {
    expect(() => base32DecodeText('MZXW6YTB1')).toThrow(/invalid base32/i);
  });
});

describe('URL query strings', () => {
  it('parses a full URL into decoded key/value pairs', () => {
    expect(parseQuery('https://example.com/path?q=hello%20world&page=2#frag'))
      .toEqual([['q', 'hello world'], ['page', '2']]);
  });
  it('parses a bare query string and decodes + as space', () => {
    expect(parseQuery('name=a+b&flag')).toEqual([['name', 'a b'], ['flag', '']]);
  });
  it('returns [] when there is no query', () => {
    expect(parseQuery('https://example.com/path')).toEqual([]);
    expect(parseQuery('')).toEqual([]);
  });
  it('buildQuery re-encodes pairs and round-trips', () => {
    expect(buildQuery([['q', 'a b'], ['x', '1&2']])).toBe('q=a%20b&x=1%262');
    expect(parseQuery('?' + buildQuery([['k', 'v v']]))).toEqual([['k', 'v v']]);
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
  it('parses inline flow sequences with UNQUOTED values (not a raw string)', () => {
    expect(yamlToJson('x:\n  allowed: [united, canada, mexico]')).toEqual({
      x: { allowed: ['united', 'canada', 'mexico'] },
    });
    expect(yamlToJson('nums: [1, 2, 3]')).toEqual({ nums: [1, 2, 3] });
    expect(yamlToJson('nested: [[a, b], [c]]')).toEqual({ nested: [['a', 'b'], ['c']] });
  });
  it('parses inline flow maps with unquoted keys and values', () => {
    expect(yamlToJson('cfg: {a: 1, b: two, c: true}')).toEqual({
      cfg: { a: 1, b: 'two', c: true },
    });
  });
  it('parses a schema-shaped document (block maps + flow enum)', () => {
    const yaml = [
      'query_intent_schema:',
      '',
      '  scope:',
      '    type: object',
      '    fields:',
      '      country:',
      '        allowed: [united states, canada]',
    ].join('\n');
    expect(yamlToJson(yaml)).toEqual({
      query_intent_schema: {
        scope: { type: 'object', fields: { country: { allowed: ['united states', 'canada'] } } },
      },
    });
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

describe('number base conversion', () => {
  it('converts between common bases and handles signed numbers', () => {
    expect(convertBaseNumber('255', 10, 16)).toBe('ff');
    expect(convertBaseNumber('0xFF', 16, 10)).toBe('255');
    expect(convertBaseNumber('1010', 2, 10)).toBe('10');
    expect(convertBaseNumber('-42', 10, 16)).toBe('-2a');
    expect(formatBaseNumber(123456789, 36)).toBe('21i3v9');
  });
  it('supports full info payloads', () => {
    expect(numberBaseInfo('42', 10).hex).toBe('2a');
    expect(numberBaseInfo('0b101010', 2).decimal).toBe('42');
  });
});

describe('markdown preview', () => {
  it('renders headings, paragraphs, emphasis, links and lists', () => {
    const html = markdownToHtml('# Title\n\n**bold** and *italic*\n\n- one\n- two\n\n[docs](https://example.com)');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<a href="https://example.com"');
  });
});

describe('escaping helpers', () => {
  it('round-trips HTML entities', () => {
    expect(escapeHtml('<a href="x">A & B\'s</a>')).toBe('&lt;a href=&quot;x&quot;&gt;A &amp; B&#39;s&lt;/a&gt;');
    expect(unescapeHtml('&lt;b&gt;hi&lt;/b&gt; &amp; &quot;quotes&quot;')).toBe('<b>hi</b> & "quotes"');
  });
  it('decodes numeric and hex character references', () => {
    expect(unescapeHtml('&#39;&#x2764;')).toBe("'\u2764");
    expect(unescapeHtml('&notareal;')).toBe('&notareal;');
  });
  it('escapes regex metacharacters so the literal matches itself', () => {
    const literal = 'a.b*c(d)';
    expect(new RegExp(escapeRegex(literal)).test(literal)).toBe(true);
    expect(escapeRegex('1+1')).toBe('1\\+1');
  });
  it('round-trips JS string escapes', () => {
    expect(escapeJsString('line\n"quoted"\ttab')).toBe('line\\n\\"quoted\\"\\ttab');
    expect(unescapeJsString('line\\n\\ttab')).toBe('line\n\ttab');
    expect(unescapeJsString(escapeJsString('emoji 🚀 "x"'))).toBe('emoji 🚀 "x"');
  });
  it('rejects malformed escape sequences', () => {
    expect(() => unescapeJsString('bad \\q')).toThrow(/valid escaped string/i);
  });
});

describe('regex safety', () => {
  it('flags nested unbounded quantifiers', () => {
    expect(analyzeRegexRisk('(a+)+$').risky).toBe(true);
    expect(analyzeRegexRisk('(\\d*)*').risky).toBe(true);
    expect(analyzeRegexRisk('(ab{2,})+').risky).toBe(true);
  });
  it('does not flag ordinary patterns', () => {
    for (const safe of ['\\d+', '(ab)+', '(a|b)*', '^\\w+@\\w+\\.\\w+$', '[a+*]+', '(a+)b*']) {
      expect(analyzeRegexRisk(safe).risky).toBe(false);
    }
  });
  it('collects matches with groups and indices', () => {
    const { matches, truncated, timedOut } = regexScan('(\\w)(\\d)', 'g', 'a1 b2');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ index: 0, value: 'a1', groups: ['a', '1'] });
    expect(truncated).toBe(false);
    expect(timedOut).toBe(false);
  });
  it('captures named groups', () => {
    const { matches } = regexScan('(?<letter>[a-z])', 'g', 'xy');
    expect(matches[0].named).toEqual({ letter: 'x' });
  });
  it('advances past zero-length matches instead of looping forever', () => {
    const { matches } = regexScan('a*', 'g', 'bbb');
    expect(matches.length).toBeLessThanOrEqual(REGEX_MATCH_LIMIT);
    expect(matches.every((m) => m.value === '')).toBe(true);
  });
  it('truncates at the match limit', () => {
    const { matches, truncated } = regexScan('.', 'g', 'x'.repeat(50), { limit: 10 });
    expect(matches).toHaveLength(10);
    expect(truncated).toBe(true);
  });
  it('stops when the time budget is exceeded', () => {
    let clock = 0;
    const { timedOut, matches } = regexScan('.', 'g', 'x'.repeat(5000), {
      timeBudgetMs: 5,
      now: () => (clock += 1),
    });
    expect(timedOut).toBe(true);
    expect(matches.length).toBeLessThan(5000);
  });
});

describe('sql formatter', () => {
  it('breaks clauses onto their own lines and uppercases keywords', () => {
    expect(sqlFormat('select a,b from t where x=1 and y=2')).toBe(
      ['SELECT', '  a,', '  b', 'FROM t', 'WHERE x = 1', '  AND y = 2'].join('\n'),
    );
  });
  it('formats joins and their on-conditions', () => {
    expect(sqlFormat('select u.id from users u left join orders o on o.user_id=u.id')).toBe(
      ['SELECT', '  u.id', 'FROM users u', 'LEFT JOIN orders o', '  ON o.user_id = u.id'].join('\n'),
    );
  });
  it('indents subqueries', () => {
    expect(sqlFormat('select * from (select id from t) x')).toBe(
      ['SELECT', '  *', 'FROM (', '  SELECT', '    id', '  FROM t', ') x'].join('\n'),
    );
  });
  it('never reformats inside string literals or comments', () => {
    expect(sqlFormat("select 'a, b' from t -- keep, this")).toBe(
      ['SELECT', "  'a, b'", 'FROM t', '-- keep, this'].join('\n'),
    );
  });
  it('keeps function calls tight but spaces keyword parens', () => {
    expect(sqlFormat('select count(*) from t where id in (1,2)')).toContain('COUNT(*)');
    expect(sqlFormat('select count(*) from t where id in (1,2)')).toContain('IN (1, 2)');
  });
  it('can leave keyword casing alone', () => {
    expect(sqlFormat('select a from t', { uppercase: false })).toBe(['select', '  a', 'from t'].join('\n'));
  });
  it('returns an empty string for empty input', () => {
    expect(sqlFormat('   ')).toBe('');
  });
  it('tokenizes strings with doubled-quote escapes as one token', () => {
    const tokens = sqlTokenize("select 'it''s'");
    expect(tokens[1]).toEqual({ t: 'string', v: "'it''s'" });
  });
});

describe('python formatter', () => {
  it('normalises tabs and mixed indentation to a fixed width', () => {
    expect(pythonFormat('def f():\n\tif x:\n\t\treturn 1\n')).toBe(
      'def f():\n    if x:\n        return 1\n',
    );
  });
  it('preserves dedents such as else branches', () => {
    expect(pythonFormat('if a:\n  x = 1\nelse:\n  y = 2\n')).toBe(
      'if a:\n    x = 1\nelse:\n    y = 2\n',
    );
  });
  it('indents bracket continuations and closes at the outer level', () => {
    expect(pythonFormat('x = [\n1,\n2,\n]\n')).toBe('x = [\n    1,\n    2,\n]\n');
  });
  it('leaves triple-quoted string contents untouched', () => {
    const src = 'def f():\n        """Doc.\n      keep   this\n        """\n        return 1\n';
    expect(pythonFormat(src)).toBe('def f():\n    """Doc.\n      keep   this\n        """\n    return 1\n');
  });
  it('strips trailing whitespace and collapses long blank runs', () => {
    expect(pythonFormat('a = 1   \n\n\n\n\nb = 2\n')).toBe('a = 1\n\n\nb = 2\n');
  });
  it('does not treat a backslash inside a comment as a continuation', () => {
    expect(pythonFormat('a = 1  # trailing \\\nb = 2\n')).toBe('a = 1  # trailing \\\nb = 2\n');
  });
  it('returns an empty string for blank input', () => {
    expect(pythonFormat('\n\n')).toBe('');
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
  it('describes common expressions in plain English', () => {
    expect(describeCron('* * * * *'.split(' '))).toBe('Every minute.');
    expect(describeCron('*/5 * * * *'.split(' '))).toBe('Every 5 minutes.');
    expect(describeCron('0 * * * *'.split(' '))).toBe('At minute 0 of every hour.');
    expect(describeCron('0 9 * * *'.split(' '))).toBe('At 09:00.');
    expect(describeCron('30 9 * * 1-5'.split(' '))).toBe('At 09:30, on Monday to Friday.');
    expect(describeCron('*/5 9-17 * * 1-5'.split(' '))).toBe('Every 5 minutes, between 09:00 and 17:59, on Monday to Friday.');
    expect(describeCron('0 0 1 * *'.split(' '))).toBe('At 00:00, on day 1 of the month.');
    expect(describeCron('0 12 * 1 *'.split(' '))).toBe('At 12:00, in January.');
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
  it('detects a URL and lists its query parameters', () => {
    const hit = detectPasteTypes('https://example.com/x?a=1&b=hello%20world').find((f) => f.label === 'URL');
    expect(hit.badge).toBe('2 params');
    expect(hit.text).toContain('b = hello world');
  });
  it('reports a URL without a query as a plain link', () => {
    const hit = detectPasteTypes('https://example.com/x').find((f) => f.label === 'URL');
    expect(hit.badge).toBe('link');
  });
  it('detects a data URI and reports its media type', () => {
    const hit = detectPasteTypes('data:image/png;base64,iVBORw0KGgo=').find((f) => f.id === 'datauri');
    expect(hit.badge).toBe('image/png');
    expect(hit.text).toContain('base64');
  });
  it('detects a valid cron expression and rejects an out-of-range one', () => {
    const hit = detectPasteTypes('*/5 9-17 * * 1-5').find((f) => f.id === 'cron');
    expect(hit.text).toMatch(/every 5 minutes/i);
    expect(detectPasteTypes('1 2 3 40 5').some((f) => f.id === 'cron')).toBe(false);
  });
  it('detects Base32 without firing on ordinary prose', () => {
    const hit = detectPasteTypes('MZXW6YTBOI======').find((f) => f.id === 'base32');
    expect(hit.text).toBe('foobar');
    expect(detectPasteTypes('hello there friend').some((f) => f.id === 'base32')).toBe(false);
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
  it('uuidV7 is a valid, time-sortable v7 uuid', () => {
    expect(uuidV7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const early = uuidV7(1000), late = uuidV7(2000);
    expect(early < late).toBe(true); // lexicographic order follows time
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
