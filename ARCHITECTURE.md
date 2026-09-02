# Architecture — tools.vanshul.com

## Design Philosophy

**Zero Runtime Dependencies.** The entire shipped application consists of three static files (`index.html`, `lib.js`, `sw.js`) with no npm packages required at runtime. This means:

- **Shipping simplicity**: No build step, no bundler, no dependency updates. Deploy by copying files to GitHub Pages.
- **Security by default**: No supply-chain risk. Every line of code ships as-is from this repository.
- **Performance**: Minimal CSS, no JS frameworks. The app loads and renders in milliseconds.
- **Offline-first**: The service worker uses network-first for the shell and cache-first for assets, so the entire app works offline after the first visit.

**Single Source of Truth.** All business logic lives in `lib.js` as **pure, deterministic functions with no side effects** (except the ID generators, which read from `crypto.subtle`). This enables:

- **Testability**: The code that ships is the code tested by Vitest. See `tests/lib.test.js`.
- **Maintainability**: Logic is separate from UI, so tools can be reused, refactored, or verified independently.
- **Clarity**: No hidden state, no event listeners in functions. Logic is explicit and composable.

**Hash Routing.** Every tool is a route (`#json`, `#base64`, `#cron`, etc.), making each tool directly linkable and shareable.

---

## The Three Files

### 1. `lib.js` — Pure Logic (574 lines, 51 exported functions)

**Purpose**: All algorithms, converters, and parsers. DOM-free. Testable.

**Exports by category**:

| Category | Functions | Notes |
|---|---|---|
| **Encoding** | `encU8`, `decU8`, `bytesToB64`, `b64ToBytes`, `b64Encode`, `b64Decode`, `b64urlDecode` | UTF-8 ⇄ bytes ⇄ Base64 |
| **JSON ⇄ YAML** | `jsonToYaml`, `yamlToJson` | Common-subset YAML parser (no anchors, aliases, block scalars) |
| **QR Encoder** | `qrEncode`, `QR_MAX_BYTES` | Byte mode, ECC-M, versions 1–10 (no Kanji/ECI) |
| **Checksums** | `crc32` | CRC32 via lookup table |
| **JSON Tools** | `jsonToTsType`, `jsonToTs`, `jsonPathQuery`, `sortKeys` | TypeScript type inference, dot/bracket path queries, key sorting |
| **CSV ⇄ JSON** | `csvToJson`, `jsonToCsv` | Handles quoted commas, escaping |
| **Text** | `splitWords`, `slugify`, `toCamel`, `toPascal`, `toSnake`, `toKebab`, `toConstant`, `titleCase`, `diffLines` | Case styles, LCS-based line diff |
| **Colors** | `parseColor`, `rgbToHsl`, `rgbToHex`, `hslToRgb` | Parses hex/rgb/hsl input; clamps values; converts between formats |
| **Cron** | `parseCronField`, `describeCron`, `cronNextRuns` | Field parsing, human-readable descriptions, next-run computation |
| **Tokens** | `estimateTokens` | Rough heuristic (chars/4 + words/0.75) / 2 for LLM tokens |
| **Timestamps** | `parseTimestamp` | Auto-detects seconds vs. milliseconds by magnitude |
| **cURL** | `parseCurl`, `curlToFetch`, `curlToPython` | Tokenizes and extracts method, URL, headers, body; generates code |
| **Smart Paste** | `printableRatio`, `detectPasteTypes` | Detects JWT, JSON, Base64, URL-encoded, hex color, timestamp, UUID, hash, integer |
| **IDs** | `uuidV4`, `uuidV7`, `ulid`, `nanoid`, `randomHex`, `password` | Uses `crypto.getRandomValues()` |
| **Query Strings** | `parseQuery`, `buildQuery` | Parses full URLs or bare query strings; handles + as space |

**Key Design Decisions**:

- **Immutability**: Functions return new values; they don't mutate inputs.
- **Defensive parsing**: Unrecognized input is silently converted or returned as null/empty, not thrown.
- **Documented limits**: QR encoder stops at v10 (2953 bytes); diff throws if >4M chars; token estimate is a heuristic.
- **Math safety**: RGB values are clamped (0–255); hue wraps modulo 360; YAML numbers are parsed with `Number()` (avoids unsafe integer parsing).

---

### 2. `index.html` — UI Shell + Tool Registry (851 lines)

**Structure**:

1. **Head**: Meta tags (viewport, description, Open Graph), favicon, manifest, preconnect hints.
2. **CSS**: Minimal embedded stylesheet (no external CSS). Variables for theming (`--text`, `--panel`, `--accent`, `--line`, `--muted`).
3. **HTML**: Semantic markup (header, nav, main, footer).
4. **Script Module**: Imports `lib.js` and renders UI.

**Key Components**:

| Component | Lines | Purpose |
|---|---|---|
| **Tool registry** | ~20 | Array of tool metadata (id, emoji, name, blurb, render function). |
| **UI helpers** | ~30 | `el()` (create elements), `field()` (label + input), `copy()` (copy to clipboard with flash), `outputBox()` (styled output div). |
| **Tool render functions** | ~600 | Each tool is defined as an object with a `render(root)` method that builds the UI for that tool. Examples: `#json`, `#base64`, `#cron`, `#qr`. |
| **Smart Paste box** | ~80 | Home-screen textarea. On input, calls `detectPasteTypes()` and renders detection cards with links to full tools. |
| **Command palette (⌘K)** | ~60 | Modal search box. On Ctrl/Cmd+K, opens palette; typing fuzzy-filters tools; arrow keys + Enter to navigate. |
| **Routing** | ~15 | On hash change, hides all tools, shows the matching tool's render output. |

**Styling**:

- **No CSS framework** — vanilla CSS with flexbox and grid.
- **Dark theme by default** — CSS variables are defined in `:root` and can be overridden.
- **Mobile-first responsive** — uses `@media (min-width: ...)` for larger screens.
- **Light and dark themes** — follows `prefers-color-scheme`, with a toggle persisted in `localStorage`.

**Error Handling**:

- **Copy to clipboard**: On failure, shows "Copy failed" for 1.2 seconds. Wrapped in try-catch.
- **Tool execution**: Most tools have try-catch around main logic; errors populate `.err` class on output box.
- **Async race condition**: Hash and HMAC use a sequence token (`let seq=0; const mine=++seq; ... if(mine!==seq) return;`) to drop stale results if user keeps typing.

---

### 3. `sw.js` — Offline Service Worker (49 lines)

**Strategy**:

- **Network-first for the shell** (`index.html`, `sw.js`, root `/`): Try network, fall back to cache.
- **Cache-first for assets** (`lib.js`, CSS, images): Use cache, fall back to network.
- **Cache version**: `tools-v5` (manually incremented on deploy if we ship breaking changes to cached assets).

**Registration**: Registered in `index.html` via `navigator.serviceWorker.register('./sw.js')`.

**Behavior**:

1. First visit: Network fetches shell and assets; service worker caches them.
2. Offline: Cache serves everything. Network requests fail silently (prefetched data remains available).
3. Online, later visits: Network fetches shell (checks for updates); assets come from cache.

**Limitations**: No automatic cache invalidation. Manual version bump in code required to force clients to re-download assets.

---

## Deployment

### Local Development

```sh
cd tools
python3 -m http.server 8081
# Open http://localhost:8081
```

(Use HTTP, not `file://`, so the service worker can register.)

### Production (GitHub Pages)

1. Ensure `CNAME` exists at the root pointing to the domain.
2. Ensure `.nojekyll` exists at the root (tells GitHub not to run Jekyll).
3. Enable GitHub Pages in repo settings (branch: `main`, source: root).
4. DNS: Point `tools.vanshul.com` CNAME to `vanshulgoyal101.github.io`.
5. GitHub auto-provides HTTPS via Cloudflare.

### Environment Variables

None. The app has no configuration or secrets.

---

## Testing

**Strategy**: Test `lib.js` functions exhaustively; use Vitest for unit tests.

**Coverage Goals**:

- ✅ All export functions should have at least one test.
- ✅ Edge cases (empty input, null, malformed data) should be tested.
- ✅ Round-trip conversions (encode/decode, JSON/YAML) should be tested.
- ✅ Known limits (QR capacity, diff size) should be tested.

**Current**: 65 pure utility tests and jsdom interaction coverage for the shipped browser module, plus Playwright E2E coverage for the browser UI.

**Running Tests**:

```sh
npm install        # First time (uses temp cache if ~/.npm is locked)
npm test           # Run all tests
npm run test:watch # Watch mode
npm run test:coverage  # Coverage report
```

See `TESTING.md` for detailed strategy and how to add E2E tests.

---

## Browser Support

Requires:

- **ES2020**: Arrow functions, destructuring, `const`/`let`, template literals, optional chaining.
- **Web Crypto API** (`crypto.subtle`): Chrome 76+, Firefox 57+, Safari 11+, Edge 79+.
- **TextEncoder/TextDecoder**: Chrome 38+, Firefox 19+, Safari 10.1+, Edge 12+.
- **Service Workers**: Chrome 40+, Firefox 44+, Safari 11.1+, Edge 17+.

**Older browsers**: App will silently fail at hash routing or crypto operations. No graceful fallback (by design — zero-deps).

---

## Known Limitations & Trade-offs

| Tool | Limitation | Reason |
|---|---|---|
| **Regex tester** | Pathological patterns yield partial results | Bounded by a match cap and wall-clock budget, plus a nested-quantifier warning; not full isolation |
| **YAML parser** | Common subset only: no anchors, aliases, multi-line blocks | Simplicity; full YAML would require hundreds of lines |
| **cURL parser** | No scheme-less URLs | Regex-based; complex edge case |
| **QR encoder** | Byte mode only; no Kanji or ECI modes | Simplicity; covers 99% of use cases |
| **QR reader** | Requires the browser's `BarcodeDetector` API | The tool never uploads a local image to a fallback service |
| **Smart Paste** | Limited types detected | Only JWT, JSON, Base64, URL-encoded, hex, timestamp, UUID, hash, integer |

---

## Performance Notes

**Bundle Size**:

- `lib.js`: ~19 KB (unminified)
- `index.html`: ~32 KB (unminified, includes inline CSS + JS)
- `sw.js`: ~1.5 KB
- **Total shipped**: ~52 KB unminified (gzips to ~12 KB)

**Runtime**:

- Most tools run in <1ms (sync, no I/O).
- QR encoder: ~5–10ms for typical URLs.
- Large diffs (4M+ chars): Blocked (intentional limit).

---

## Security Model

**No Data Leakage**:

- All computation is in-browser. Zero network calls for tool operations.
- Service worker only caches static assets (no user data).
- Cookies: None. Local storage: None.

**Crypto**:

- Uses `crypto.subtle` (native, audited Web Crypto API) for:
  - SHA-1, SHA-256, SHA-512 (hash tool)
  - HMAC-SHA-256/384/512 (HMAC tool)
- Uses `crypto.getRandomValues()` for ID generators (CSPRNG).

**Input Validation**:

- Parsers are defensive: unrecognized input returns null or empty.
- No `eval()`, `Function()`, or dynamic code execution.
- No HTML injection in detected types (Smart Paste shows results in `<pre>`, not `innerHTML`).

---

## Future Improvements

**Planned**:

- [x] Playwright E2E tests for all tool workflows.
- [x] Per-tool JSON-LD schema for SEO.
- [x] Number-base converter (radix 2–36).
- [x] QR code reader (if BarcodeDetector API available; fallback to note).
- [ ] Comprehensive WCAG 2.1 audit + fixes.
- [x] Base32 encoder/decoder (RFC 4648).

**Out of Scope** (for simplicity):

- Full YAML support (anchors, aliases, block scalars).
- Regex execution in a Web Worker (the bounded scan in `regexScan` covers the practical cases).
- Account / cloud sync (loses privacy benefit).
- Mobile app (PWA is sufficient).

---

## Contributing

See CONTRIBUTING.md (if present) or create a PR with detailed rationale for any changes.

**Code standards**:

- All business logic goes in `lib.js` (testable, reusable).
- UI code stays in `index.html` (render functions, event listeners).
- Tests go in `tests/lib.test.js` (Vitest assertions).
- Keep lines <120 characters. Use semicolons. Prefer functional style.
