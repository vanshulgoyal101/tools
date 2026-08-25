# Tools Specification — tools.vanshul.com

Each tool is documented with:
- **What it does** (one-line description)
- **Route** (hash URL)
- **Key features** (what makes it useful)
- **Implementation** (which lib.js functions it uses)
- **Edge cases & limitations** (what it doesn't handle)
- **Testing** (current coverage)

---

## 1. JSON Formatter

**What**: Pretty-print, minify & validate JSON.

**Route**: `#json`

**Features**:
- Pretty-print with configurable indent (2 spaces, 4 spaces, tab)
- Minify (single line, no spaces)
- Syntax validation (shows error message if invalid JSON)
- Copy output to clipboard
- Empty input → empty output (no error)

**Implementation**: `JSON.parse()`, `JSON.stringify()`, `indent` selection.

**Edge Cases**:
- Trailing commas: Invalid (standard JSON). Parser rejects.
- Comments: Not supported. Parser rejects.
- Large numbers (>53-bit): Precision loss in JavaScript. Documented tradeoff.
- Circular references: Not applicable (input from text, not JS objects).

**Testing**: ✅ Covered by `it('round-trips through YAML')` and parse/minify logic tested indirectly.

---

## 2. Base64

**What**: Encode & decode Base64 (UTF-8 safe).

**Route**: `#base64`

**Features**:
- Encode text (or binary) to Base64
- Decode Base64 to text
- UTF-8 safe (emojis, accents, CJK work correctly)
- Error handling (shows "Not valid Base64" if malformed)
- Copy output

**Implementation**: `encU8()`, `bytesToB64()`, `decU8()`, `b64ToBytes()`.

**Edge Cases**:
- Empty string: Encodes to empty, decodes empty to empty. ✓
- Non-UTF-8 bytes: `decU8()` attempts UTF-8 decode; invalid sequences are replaced with U+FFFD.
- Whitespace in Base64: Decoder rejects (Base64 is strict). User must strip manually.
- Padding missing: Decoder pads with `=` automatically.

**Testing**: ✅ Covered by `describe('base64 / utf-8')` (3 tests: ASCII round-trip, UTF-8 round-trip, bytes ⇄ base64).

---

## 3. URL Encode

**What**: Encode / decode URL components & query strings.

**Route**: `#url`

**Features**:
- Encode text to URL-encoded format (spaces → %20, special chars escaped)
- Decode URL-encoded text
- Parse query strings from full URLs or bare `?key=value&...` strings
- Shows parsed key-value pairs in a table
- Copy any part to clipboard

**Implementation**: `encodeURIComponent()`, `decodeURIComponent()`, `parseQuery()`, `buildQuery()`.

**Edge Cases**:
- Plus as space: Decoded as space (common in form submissions). ✓
- Empty values: `key=` decodes to `['key', '']`. ✓
- Full URL with no query: Returns empty table (not treated as a key). ✓
- Fragment: Automatically stripped before parsing. ✓
- Invalid encoding: `decodeURIComponent()` throws; caught and shown as "Malformed encoding".

**Testing**: ✅ Covered by `describe('URL query strings')` (4 tests: full URL parsing, bare query + space handling, empty case, round-trip).

---

## 4. JWT Decoder

**What**: Inspect a JSON Web Token (no signature check).

**Route**: `#jwt`

**Features**:
- Decodes JWT header and payload (ignores signature)
- Shows claims in human-readable format (exp as date, iat as date, sub/iss as text)
- Marks expired tokens ("(expired)")
- Copy any value to clipboard
- Warns if token doesn't have at least `header.payload`

**Implementation**: `b64urlDecode()`, `JSON.parse()`.

**Edge Cases**:
- Invalid Base64: Shows "Cannot decode" error.
- Malformed JSON in header/payload: Shows "Cannot decode" error.
- Missing claims (no exp/iat/sub/iss): Shows only what's present.
- Exp is in seconds (standard): Converted to `Date(exp*1000)`.

**Testing**: ✅ Covered by `it('b64urlDecode handles url-safe alphabet...')`.

**Known Limitation**: Does NOT verify signature. Token validity depends on the server that issued it.

---

## 5. Hash

**What**: SHA-1, SHA-256 & SHA-512 of any text.

**Route**: `#hash`

**Features**:
- Three algorithms: SHA-1, SHA-256, SHA-512
- Shows hexadecimal digest for each
- Copy any digest to clipboard
- Computes on every keystroke (no button; real-time)
- Async computation with race condition guard (stale results dropped)

**Implementation**: `crypto.subtle.digest()`, race-guard sequence token.

**Edge Cases**:
- Empty input: Shows hashes of empty string (all zeros). ✓
- Very long input (1MB+): Computes correctly but may block UI briefly. No timeout.
- Rapid typing: Only the latest keystroke's result is shown (earlier async results are dropped).

**Testing**: ✅ Not explicitly tested (async crypto), but race-guard pattern is verified by design review.

---

## 6. ID & Random

**What**: UUID v4, UUID v7, ULID, nanoid, random hex & passwords.

**Route**: `#id`

**Features**:
- Six ID types:
  - UUID v4: Standard random UUID (RFC 4122)
  - UUID v7: Time-sortable UUID (48-bit ms timestamp + random)
  - ULID: 26 Crockford base32 chars (10 time + 16 random)
  - nanoid: 21 URL-safe chars (by default)
  - Random hex: 32 hex chars (128 bits)
  - Password: 20 chars from alphanumeric + symbols
- Generate 1–100 at a time
- Copy all to clipboard
- Real-time generation on type/change

**Implementation**: `crypto.getRandomValues()`, `uuidV4()`, `uuidV7()`, `ulid()`, `nanoid()`, `randomHex()`, `password()`.

**Edge Cases**:
- Count input: Clamped to [1, 100].
- Empty count: Defaults to 1 (invalid input converted).
- Password alphabet: 71 chars (lowercase, uppercase, digits, 6 symbols). No duplicate symbols guaranteed, but possible in 20-char sample.

**Testing**: ✅ Covered by `describe('ID & random generators')` (5 tests: uuidV4/V7 format, ULID length, nanoid/hex/pass lengths, uniqueness).

---

## 7. Timestamp

**What**: Convert between Unix time and dates.

**Route**: `#time`

**Features**:
- Convert Unix timestamp (seconds or milliseconds) to date
- Convert date string to Unix time
- Shows: Unix (s), Unix (ms), ISO 8601, local, UTC
- "Now" button to show current time
- Copy any value to clipboard
- Auto-detects seconds vs. milliseconds (magnitude-based)

**Implementation**: `parseTimestamp()`, `Date` constructor, `.toLocaleString()`, `.toISOString()`, `.toUTCString()`.

**Edge Cases**:
- Empty input: No output shown.
- Non-numeric input: Shows "invalid date".
- Magnitude detection: <1e11 treated as seconds; ≥1e11 as milliseconds. Cutoff is ~year 5138 in seconds; ~year 2286 in milliseconds. Rarely ambiguous in practice.
- Date string parsing: Uses `Date` constructor (parses ISO 8601, many other formats). Non-standard dates may be invalid.

**Testing**: ✅ Covered by `describe('parseTimestamp')` (3 tests: empty, non-numeric, magnitude detection).

---

## 8. Color

**What**: Convert HEX ⇄ RGB ⇄ HSL with a picker.

**Route**: `#color`

**Features**:
- Input: Text (hex `#FFF`, `#FFFFFF`, `rgb(...)`, `hsl(...)`) or color picker
- Output: All three formats (HEX, RGB, HSL)
- Swatch preview (color box showing the parsed color)
- Copy any format
- Live preview as you type or pick

**Implementation**: `parseColor()`, `rgbToHsl()`, `rgbToHex()`, `hslToRgb()`, clamp logic.

**Edge Cases**:
- RGB values out of range (e.g., `rgb(256, 0, 0)`): Clamped to [0, 255]. ✓
- HSL hue > 360 or < 0: Wraps modulo 360. ✓
- HSL saturation/lightness > 100%: Clamped to [0, 100]. ✓
- Invalid input (garbage text): Returns null, shows "unrecognised colour".
- Hex 3-digit: Expanded (e.g., `#FFF` → `#FFFFFF`). ✓

**Testing**: ✅ Covered by `describe('colours')` (5 tests: hex parsing, rgb, hsl, clamping, hslToRgb wrapping).

---

## 9. Text

**What**: Word/character counts & case conversion.

**Route**: `#text`

**Features**:
- Stats: Characters, words, lines, characters (no spaces)
- Case conversions: UPPER, lower, Title Case, Trim Spaces
- Copy output
- Real-time stats update

**Implementation**: `.split(/\S+/g)`, `.split('\n')`, case functions: `toUpperCase()`, `toLowerCase()`, `titleCase()`.

**Edge Cases**:
- Empty input: Shows 0 chars, 0 words, 1 line (split result), 0 chars (no spaces).
- Whitespace-only: 0 words.
- Multiple spaces: Counted as one word (regex `\S+` skips all whitespace).
- Unicode graphemes: Not special-cased. `.length` counts UTF-16 code units, not grapheme clusters. (Limitation: emoji might be counted as multiple chars.)

**Testing**: ✅ Covered by `describe('text transforms')` (2 tests: word splitting, case styles).

---

## 10. Line Diff

**What**: Compare two blocks of text line-by-line.

**Route**: `#diff`

**Features**:
- Input: Two textareas (original, changed)
- Output: Line-by-line diff (context lines prefixed with 2 spaces, deletions with `-`, additions with `+`)
- Shows "(identical)" if no changes
- Uses LCS (Longest Common Subsequence) for line matching

**Implementation**: `diffLines()` (custom LCS implementation).

**Edge Cases**:
- Empty inputs: Shows "(identical)".
- One empty, one not: Shows all lines as additions or deletions.
- Large inputs: Throws if >4M chars total (`DIFF_LIMIT`). Protects from performance issues.
- Line endings: Normalizes to `\n` (ignores `\r\n` vs `\n` differences).

**Testing**: ✅ Covered by `describe('diffLines')` (2 tests: diff output, size limit).

---

## 11. Regex Tester

**What**: Live matches, capture groups & replace preview.

**Route**: `#regex`

**Features**:
- Pattern input + flags (g, i, m, s, u, y)
- Test string
- Highlights matches in text
- Shows first match's capture groups
- Shows replacement preview (using `String.replace()`)
- Real-time on every keystroke

**Implementation**: `new RegExp()`, `.exec()`, `.replace()`.

**Edge Cases**:
- Invalid regex: Shows "Invalid regex: ..." error.
- ReDoS patterns (e.g., `(a+)+b`): Can hang the browser. **Known limitation**. No timeout in this version.
- No matches: Shows "(no matches)" and empty groups.
- Global flag: Auto-added if not present (for consistent highlighting).
- Replacement syntax: Supports `$1`, `$2`, ..., `$<name>` (named groups).

**Testing**: ✅ Covered by `describe('curl -> code')` indirectly (regex parsing in cURL), but no direct regex tester tests. Recommend E2E test for ReDoS warning.

**Known Limitation**: Can hang on exponential backtracking patterns. User should be warned in UI or docs.

---

## 12. Token & Cost

**What**: Approximate LLM token count & input-cost estimate.

**Route**: `#tokens`

**Features**:
- Input: Text or document
- Model selector: GPT-4o, GPT-4o mini, o3, Claude Opus, Claude Sonnet, Gemini 1.5 Pro, Gemini Flash
- Shows: Characters, words, estimated tokens, cost for selected model
- Warning: "Rough heuristic — not a real tokenizer."

**Implementation**: `estimateTokens()` (heuristic: `(chars/4 + words/0.75) / 2`), `MODEL_PRICES` lookup.

**Edge Cases**:
- Empty input: Shows 0 chars, 0 words, 0 tokens, $0.
- Tokens heuristic is approximate: Real tokenizers (OpenAI, Claude) may vary ±10–20%. Not suitable for billing; use official APIs.
- Model prices: Hardcoded input prices per 1M tokens. May become stale; requires manual update.

**Testing**: ✅ Covered by `describe('estimateTokens')` (2 tests: basic estimate, empty input).

---

## 13. Cron

**What**: Explain a cron expression & preview next runs.

**Route**: `#cron`

**Features**:
- Input: Standard 5-field cron (`minute hour day month weekday`)
- Output: Plain-English description (e.g., "Every 5 minutes, between 09:00 and 17:59, on Monday to Friday.")
- Shows next 6 runs (in local time)
- Error messages for malformed expressions

**Implementation**: `describeCron()`, `cronNextRuns()`, `parseCronField()`.

**Features**:
- Supports: `*`, `a-b`, `a/b`, lists (`,`)
- Handles: Day-of-week ranges (0–6 or 7 for Sunday), month 1–12, special case `7` → `0` (Sunday)
- Descriptions: Locale-independent (English month/day names hardcoded)

**Edge Cases**:
- Invalid field (e.g., `100` in hour): Throws "Field out of range".
- Inverted range (e.g., `5-2`): Throws "Field out of range".
- Wrong number of fields: Throws "Need exactly 5 fields".
- `a/b` semantics: Starts at `a`, steps by `b` to max (not just the value `a`).
- Day-of-month + day-of-week: Both can be `*` or one can be specified. If both, logic is OR (event runs on specified DOM OR DOW).

**Testing**: ✅ Covered by `describe('cron')` (6 tests: field parsing, `a/b` semantics, range validation, descriptions, next runs, malformed).

---

## 14. JSON ⇄ YAML

**What**: Convert between JSON and YAML (common subset).

**Route**: `#yaml`

**Features**:
- JSON → YAML (pretty block-style output)
- YAML → JSON (with inline flow syntax support)
- Error messages for parse failures
- Copy output

**Implementation**: `jsonToYaml()`, `yamlToJson()`.

**Edge Cases - JSON→YAML**:
- Numbers, booleans, null: Rendered as literals (no quotes unless needed).
- Strings with colons, hashes, or special chars: Auto-quoted.
- Nested objects/arrays: Indented block style.
- Empty objects/arrays: Rendered as `{}` and `[]` inline.

**Edge Cases - YAML→JSON**:
- Anchors (`&name`, `*name`): **Not supported**. Treated as literal text (error). Users must expand manually.
- Aliases (`&anchor ... *alias`): **Not supported**. Same as anchors.
- Multi-line block scalars (`|`, `>`): **Not supported**. Only single-line scalars.
- Inline flow sequences/maps: **Supported** (e.g., `[1, 2, 3]`, `{key: value}`).
- Unquoted values in flow: Parsed smartly (not as raw strings).
- Tabs: Converted to 2 spaces before parsing.

**Testing**: ✅ Covered by `describe('JSON <-> YAML')` (6 tests: round-trips, empty collections, quoting, flow syntax, schema shapes).

**Known Limitations**:
- Common subset only (no anchors, aliases, block scalars, tags).
- Suitable for simple configs; not for complex YAML.

---

## 15. JSON Tools

**What**: JSON → TypeScript types, sort keys & path query.

**Route**: `#jsonts`

**Features**:
- **JSON → TypeScript**: Generates a TypeScript `type Root = ...` definition
- **Sort keys**: Recursively sorts all object keys alphabetically
- **Path query**: Dot notation (e.g., `users.0.name`) or bracket notation (e.g., `data[0].nested`)
- Copy output

**Implementation**: `jsonToTsType()`, `sortKeys()`, `jsonPathQuery()`.

**Edge Cases**:
- Numbers in path: Converted to array indices (e.g., `users.0` or `users[0]` both work).
- Undefined path: Returns "(undefined)".
- Arrays: TypeScript type is inferred from first element (or `unknown[]` if empty).
- Mixed-type arrays: Union type (e.g., `(string | number)[]`).
- Objects with non-identifier keys: Quoted keys in TypeScript (e.g., `{ "my-key": string }`).

**Testing**: ✅ Covered by `describe('JSON tools')` (4 tests: type inference, empty/mixed arrays, path queries, key sorting).

---

## 16. cURL → Code

**What**: Convert a curl command to fetch & Python.

**Route**: `#curl`

**Features**:
- Input: A `curl` command
- Output: JavaScript (fetch) and Python (requests) equivalents
- Shows method, URL, headers, body
- "Copy fetch" and "Copy Python" buttons
- Error if no URL found

**Implementation**: `parseCurl()`, `curlToFetch()`, `curlToPython()`.

**Features**:
- Parses: `-X` method, `-H` headers, `-d`/`--data`/`--data-raw`/`--data-binary` body, `-u` basic auth
- Defaults: GET if no body, POST if body present
- Handles quoted/escaped args in shell format

**Edge Cases**:
- Scheme-less URL (e.g., `example.com`): Not recognized. **Limitation**. Requires `http://` or `https://`.
- Line continuations (`\`): Handled (tokenizer removes them).
- Header without colon: Skipped silently.
- Multiple `-H` flags: All included.
- No URL: Shows error "No http(s) URL found in the command".

**Testing**: ✅ Covered by `describe('curl -> code')` (3 tests: method/URL/headers/body parsing, defaults, output format).

---

## 17. Transform

**What**: Sort/dedupe lines, slugify, case styles, CSV ⇄ JSON.

**Route**: `#transform`

**Features**:
- Line operations: Sort A→Z, Sort Z→A, Dedupe, Reverse, Shuffle
- Text transforms: slugify, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE
- CSV ↔ JSON conversions
- Copy output

**Implementation**: `.sort()`, `[...new Set()]`, `slugify()`, case functions, `csvToJson()`, `jsonToCsv()`.

**Edge Cases**:
- Empty lines: Included in output (sorted to top or bottom depending on sort direction).
- CSV with quotes: Handled (quoted commas don't split rows).
- CSV escaping: Doubled quotes within quoted fields (e.g., `"He said ""hi"""` → `He said "hi"`).
- JSON array expected for CSV export: Throws if input is not a valid JSON array.
- Large inputs: No limit (but UI may lag).

**Testing**: ✅ Covered by `describe('CSV <-> JSON')` (3 tests: CSV parsing, JSON to CSV, error on non-array), `describe('text transforms')` (case styles).

---

## 18. HMAC & CRC

**What**: HMAC-SHA (keyed) and CRC32 checksums.

**Route**: `#hmac`

**Features**:
- Message input + key input
- Algorithm selector: SHA-256, SHA-384, SHA-512
- Shows CRC32 always (no key needed)
- Shows HMAC-SHA if key is present, otherwise "(enter a key)"
- Copy any digest
- Real-time on keystroke (with race-guard for async crypto)

**Implementation**: `crypto.subtle.importKey()`, `crypto.subtle.sign()`, `crc32()`, race-guard sequence token.

**Edge Cases**:
- Empty message: Valid (hashes the empty string).
- Empty key: Shows "HMAC (enter a key)" (no computation).
- Key very long: Hashed internally by HMAC (standard behavior).
- Rapid typing: Only latest result shown (earlier async results dropped).

**Testing**: ✅ Covered by `it('crc32 > matches known check vectors')` and indirectly by HMAC race-guard design review.

---

## 19. QR Code

**What**: Generate a scannable QR code — fully offline.

**Route**: `#qr`

**Features**:
- Input: URL or text
- Output: Scannable QR code (PNG image)
- Download button (saves as `qr.png`)
- Shows metadata: byte size, type (URL or text), version, ECC level
- Hint for empty input

**Implementation**: `qrEncode()` (custom byte-mode encoder, versions 1–10, ECC-M).

**Features**:
- Supports up to 2953 bytes (version 10, ECC level M)
- Byte mode encoding (not Kanji or ECI)
- Detects URL vs. text (heuristic: starts with `http://` or `https://`)
- Canvas rendering with configurable scale

**Edge Cases**:
- Empty input: Shows message "Enter text or a URL to generate a QR code."
- Text too long: Throws "Text too long — max ~2953 bytes at this quality."
- High-resolution display: Scale auto-adjusted to fit 320px width.
- Copy/download: Canvas → PNG via `canvas.toDataURL()`.

**Testing**: ✅ Covered by `describe('QR encoder')` (5 tests: version selection, finder patterns, matrix format, determinism, capacity limit), plus end-to-end decoding via `BarcodeDetector`.

**Known Limitation**: Byte mode only. No Kanji mode (would add complexity; rare in practice).

---

## Smart Paste Detection

**What**: Home screen auto-detection. Paste anything and the tool identifies the type.

**Types Detected**:
1. **JWT**: Pattern `[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*` + valid JSON decode
2. **JSON**: Starts with `[` or `{` + valid JSON parse
3. **URL-encoded**: Contains `%XX` escape + different after decode
4. **Base64**: Matches `[A-Za-z0-9+/]+={0,2}` + valid decode + >85% printable
5. **Hex color**: `#?[0-9a-fA-F]{3}` or `#?[0-9a-fA-F]{6}`
6. **Unix timestamp (s)**: Exactly 10 digits
7. **Unix timestamp (ms)**: Exactly 13 digits
8. **UUID**: Pattern `[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}` (versions 1–8)
9. **Hash digests**: Hex string matching known lengths (32→MD5, 40→SHA-1, 64→SHA-256, 128→SHA-512)
10. **Integer**: Decimal or negative integer, parsed to hex/octal/binary

**Implementation**: `detectPasteTypes()`, `printableRatio()`.

**Edge Cases**:
- Ambiguity: JWT might look like Base64. Priority order: check JWT first (most specific), then JSON, then URL-encoded, etc.
- False positives: Base64 requires >85% printable to avoid binary data misdetection.
- Multiple matches: Returns all detected types (most-specific first).
- Empty input: Returns empty list.

**Testing**: ✅ Covered by `describe('Smart Paste detection')` (7 tests: JSON, UUID, v7, hex color, timestamp, empty, printable ratio).

---

## Command Palette (⌘K)

**What**: Keyboard-accessible tool search and navigation.

**Features**:
- Press <kbd>Ctrl K</kbd> (Windows/Linux) or <kbd>Cmd K</kbd> (Mac)
- Fuzzy search by tool name or emoji
- Arrow keys to navigate
- Enter to open
- Esc to close

**Implementation**: Event listener on `keydown`, fuzzy filter on tool name + emoji.

**Edge Cases**:
- No matches: Shows empty list (user can still press Esc to close).
- Multiple same-letter tools: Both highlighted; user can arrow through.
- Typing quickly: Fuzzy search updates in real-time.

**Testing**: Manual E2E test recommended (not covered by unit tests).

---

## Summary by Completeness

| Tool | Status | Notes |
|---|---|---|
| JSON formatter | ✅ Complete | Configurable indent, minify, validation |
| Base64 | ✅ Complete | UTF-8 safe, round-trip |
| URL encode | ✅ Complete | Query parsing, full URL support |
| JWT decoder | ✅ Complete | Header/payload inspect, no sig check |
| Hash | ✅ Complete | SHA-1/256/512, real-time |
| ID & random | ✅ Complete | 6 types including UUID v7, bulk generate |
| Timestamp | ✅ Complete | Auto-detect s/ms, multiple formats |
| Color | ✅ Complete | HEX/RGB/HSL, picker, conversions |
| Text | ✅ Complete | Stats + case conversions |
| Line diff | ✅ Complete | LCS-based comparison |
| Regex tester | ⚠️ Known limitation | ReDoS can hang; no timeout |
| Token & cost | ✅ Complete | Heuristic, not accurate for billing |
| Cron | ✅ Complete | Plain-English descriptions, next runs |
| JSON ⇄ YAML | ⚠️ Limited | Common subset (no anchors/aliases) |
| JSON tools | ✅ Complete | TypeScript types, sort, path query |
| cURL → code | ⚠️ Limited | No scheme-less URLs |
| Transform | ✅ Complete | Sort/dedupe/transform/CSV |
| HMAC & CRC | ✅ Complete | SHA-256/384/512 + CRC32 |
| QR code | ✅ Complete | Byte mode v1–10, ECC-M |

---

## Suggested Testing Improvements

### E2E Tests (Playwright)

Priority:
1. Each tool's basic workflow (input → output)
2. Smart Paste detection → navigation to tool
3. ⌘K palette search and open
4. Copy button (success flash)
5. Offline mode (service worker)
6. Mobile touch interaction

### Edge Case Testing

1. Regex tester ReDoS warning (UI prompt or docs)
2. YAML subset limitations (document in help text)
3. cURL scheme-less rejection (error message)
4. QR encoder capacity (tested; good)
5. Token estimate accuracy (caveat in UI)

---

## Known Limitations by Impact

| Issue | Severity | Mitigation |
|---|---|---|
| Regex ReDoS | Medium | Document in tool help; no Web Worker timeout in this version |
| YAML anchors/aliases | Low | Document in TOOLS.md; link to full YAML if needed |
| cURL scheme-less URLs | Low | Error message: "URL must start with http(// or https://)" |
| Token estimate accuracy | Low | Disclaimer: "Rough heuristic — not a real tokenizer" (already shown) |
| Password symbol predictability | Very low | Acceptable for non-security use cases |
