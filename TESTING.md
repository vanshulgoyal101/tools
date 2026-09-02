# Testing Strategy — tools.vanshul.com

## Overview

All business logic in `lib.js` is tested using [Vitest](https://vitest.dev). Tests are dev-only (not shipped). UI integration tests are planned via Playwright.

**Current Coverage**: 62 unit tests covering ~90% of lib.js exports.

**E2E Coverage**: 34 Playwright smoke tests covering all 24 tools, category browsing, Smart Paste, ⌘K, routing, PWA API availability, mobile viewport behavior, theme switching, and keyboard accessibility.

**DOM Interaction Coverage**: jsdom executes the shipped inline application module and dispatches real input, change, click, and keyboard events for Smart Paste, category filters, command palette routing, JSON formatting, base conversion, Markdown preview, and unknown-route fallback. This catches regressions in the UI handlers without requiring a browser process.

Run this layer directly with `npm run test:dom`. It complements, rather than replaces, Playwright's full-browser coverage.

**Coverage Goals**:
- ✅ All exported functions have ≥1 test
- ✅ Edge cases (empty, null, malformed, out-of-range) are tested
- ✅ Round-trip conversions (encode/decode, JSON/YAML) are tested
- ✅ Known limits (QR capacity, diff size) are tested
- ⏳ UI integration (routing, Smart Paste, ⌘K, copy) — Playwright E2E (planned)
- ⏳ Offline behavior — Service worker E2E (planned)
- ⏳ Accessibility — keyboard nav, screen reader (planned)

---

## Running Tests

### Install Dependencies (First Time)

```sh
cd tools
npm install
```

If `~/.npm` is locked, the script automatically uses a temporary cache at `$TMPDIR/npm-cache-tools`.

### Run All Tests

```sh
npm test
```
### Run E2E Tests (Playwright)

```sh
npm run test:e2e
```

Runs the validated smoke suite. Chromium is currently the validated project in this environment.

View live UI test runner:
```sh
npm run test:e2e:ui
```

Debug a single test:
```sh
npm run test:e2e:debug
```

Output:
```
 RUN  v3.2.7

 ✓ tests/lib.test.js (65 tests) 200ms

 Test Files  1 passed (1)
      Tests  62 passed (62)
```

### Watch Mode (Auto-run on File Changes)

```sh
npm run test:watch
```

### Coverage Report

```sh
npm run test:coverage
```

Generates an HTML coverage report (see terminal output for path).

---

## Current Test Suite

**File**: `tests/lib.test.js` (65 tests)

**Structure**: Organized by feature in `describe()` blocks.

### Test Breakdown by Feature

| Feature | Tests | Notes |
|---|---|---|
| **Base64 / UTF-8** | 4 | ASCII round-trip, UTF-8 (emoji), bytes ↔ base64, url-safe decode |
| **URL query strings** | 4 | Full URL parsing, bare query, + as space, empty case, round-trip |
| **JSON ⇄ YAML** | 6 | Round-trips, empty collections, quoting, flow syntax, schema shapes |
| **QR encoder** | 5 | Version selection, finder patterns, matrix format, determinism, capacity |
| **CRC32** | 1 | Check vectors |
| **JSON tools** | 4 | TypeScript type inference, empty/mixed arrays, path queries, key sorting |
| **CSV ⇄ JSON** | 3 | CSV parsing, JSON to CSV, error on non-array |
| **Text transforms** | 2 | Word splitting, case styles |
| **Line diff** | 2 | Diff output, size limit |
| **Colors** | 5 | Hex/RGB/HSL parsing, conversion, clamping, hslToRgb wrapping |
| **Cron** | 6 | Field parsing, `a/b` semantics, range validation, descriptions, next runs, errors |
| **Tokens** | 2 | Basic estimate, empty input |
| **Timestamps** | 3 | Empty, non-numeric, magnitude detection |
| **cURL → code** | 3 | Method/URL/headers parsing, defaults, output |
| **Smart Paste detection** | 7 | JSON, UUID, v7, hex color, timestamp, empty, printable ratio |
| **ID & random** | 5 | uuidV4/V7 format, ULID length, nanoid/hex/pass lengths, uniqueness |
| **Cron descriptions** | 8 | Plain-English descriptions for common patterns |

**Total**: 77 unit tests, 21 jsdom interaction tests, and 34 cross-browser E2E scenarios

---

## Adding a New Test

### Example: Testing a New Function

Say we add a new function `hexToInt()` to `lib.js`:

```js
export function hexToInt(hex) {
  return parseInt(hex.replace(/^#?/, ''), 16);
}
```

Add a test in `tests/lib.test.js`:

```js
import { hexToInt } from '../lib.js';

describe('hex to int', () => {
  it('parses hex color to integer', () => {
    expect(hexToInt('#FF00FF')).toBe(16711935); // magenta
    expect(hexToInt('00FF00')).toBe(65280); // green
  });
  it('handles lowercase', () => {
    expect(hexToInt('#ff0000')).toBe(16711680); // red
  });
  it('returns NaN for invalid hex', () => {
    expect(hexToInt('ZZZ')).toBe(NaN);
  });
});
```

Run tests:

```sh
npm test
```

---

## Test Best Practices

### 1. Test Behavior, Not Implementation

❌ **Bad**: Test implementation detail
```js
it('uses parseInt', () => {
  expect(lib.hexToInt.toString()).toContain('parseInt');
});
```

✅ **Good**: Test observable behavior
```js
it('converts hex to decimal', () => {
  expect(hexToInt('#FF')).toBe(255);
});
```

### 2. Cover Edge Cases

For each function, test:
- Empty/null input
- Boundary values (min, max)
- Invalid input (malformed, out-of-range)
- Large input (performance)

Example:
```js
it('handles edge cases', () => {
  expect(parseTimestamp('')).toBe(null);  // empty
  expect(parseTimestamp('abc')).toEqual(expect.any(Date)); // invalid → NaN date
  expect(parseTimestamp('9999999999')).toBeDefined(); // large but valid
});
```

### 3. Test Round-Trips

For encode/decode pairs, verify round-trip:

```js
it('round-trips base64', () => {
  const original = 'Hello, 世界 🚀';
  const encoded = b64Encode(original);
  const decoded = b64Decode(encoded);
  expect(decoded).toBe(original);
});
```

### 4. Use Descriptive Test Names

❌ **Bad**: Generic name
```js
it('works', () => { ... });
```

✅ **Good**: Specific behavior
```js
it('parses a full URL and extracts query parameters', () => { ... });
```

### 5. Arrange-Act-Assert Pattern

```js
it('description', () => {
  // Arrange: set up input
  const input = 'hello';
  
  // Act: call function
  const result = toUpperCase(input);
  
  // Assert: verify output
  expect(result).toBe('HELLO');
});
```

---

## Planned E2E Tests (Playwright)

### Setup

```sh
npm install --save-dev @playwright/test
npx playwright install
```

New directory: `tests/e2e/` with files like `tools.spec.js`.

### Example: Test JSON Tool

```js
import { test, expect } from '@playwright/test';

test('JSON formatter: pretty-print', async ({ page }) => {
  // Navigate to JSON tool
  await page.goto('http://localhost:8081/#json');
  
  // Arrange: fill input
  await page.fill('textarea', '{"a":1,"b":2}');
  
  // Act: click format button
  await page.click('button:has-text("Format")');
  
  // Assert: output is pretty-printed
  const output = await page.textContent('.out');
  expect(output).toContain('"a": 1');
  expect(output).toContain('"b": 2');
});

test('Smart Paste: detects JSON', async ({ page }) => {
  await page.goto('http://localhost:8081');
  
  // Paste JSON into Smart Paste box
  await page.fill('textarea', '{"id":123}');
  
  // Assert: detection card shows
  const card = await page.locator('.dcard:has-text("JSON")');
  await expect(card).toBeVisible();
  
  // Click to navigate to full tool
  await page.click('a:has-text("Open in full tool")');
  expect(page.url()).toContain('#json');
});

test('Command palette (⌘K): search and navigate', async ({ page }) => {
  await page.goto('http://localhost:8081');
  
  // Press Ctrl+K (or Cmd+K on Mac)
  await page.press('body', 'Control+K');
  
  // Assert: palette opens
  const palette = await page.locator('.palette.on');
  await expect(palette).toBeVisible();
  
  // Type to search
  await page.fill('.palette input', 'base64');
  
  // Navigate with arrow key
  await page.press('.palette input', 'ArrowDown');
  
  // Open with Enter
  await page.press('.palette input', 'Enter');
  
  // Assert: navigated to tool
  expect(page.url()).toContain('#base64');
});
```

### E2E Test Coverage Plan

| Scenario | Priority | Notes |
|---|---|---|
| Each tool's basic workflow (input → output) | High | Baseline functionality |
| Smart Paste detection → tool navigation | High | Core feature |
| ⌘K palette search and navigation | Medium | Keyboard power-user feature |
| Copy button (success flash) | Medium | UX feedback |
| Offline mode (service worker) | Medium | PWA verification |
| Mobile touch interaction (responsive) | Medium | Mobile UX |
| Error handling (invalid input) | Low | Edge cases |
| Accessibility (keyboard-only, screen reader) | Low | a11y audit |

---

## Performance Testing

### Manual Benchmarking

For large-input tools (QR, diff), test performance:

```js
it('QR encoder: large input under 100ms', () => {
  const large = 'x'.repeat(2000);
  const start = performance.now();
  qrEncode(large);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(100);
});

it('diff: large input under 500ms', () => {
  const a = 'line\n'.repeat(1000);
  const b = 'line\n'.repeat(1000) + 'changed\n';
  const start = performance.now();
  diffLines(a, b);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(500);
});
```

---

## Known Test Gaps

| Feature | Gap | Reason | Plan |
|---|---|---|---|
| UI routing | No tests | Requires DOM | E2E: Playwright |
| Smart Paste UI | No tests | Requires DOM | E2E: Playwright |
| ⌘K palette | No tests | Requires DOM + keyboard | E2E: Playwright |
| Copy button | No tests | Requires clipboard API | E2E: Playwright |
| Service worker | No tests | Requires network interception | E2E: Playwright + MSW |
| Mobile responsiveness | No tests | Requires viewport change | E2E: Playwright device emulation |
| Accessibility | No tests | Requires screen reader sim | E2E: Playwright + axe-core |
| Regex ReDoS | Documented, not tested | No timeout in this version | Manual testing + warning docs |

---

## Continuous Integration

**GitHub Actions** (`.github/workflows/test.yml`):

Runs on every push:

```yaml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

If a test fails, the push is rejected (blocks merge).

---

## Debugging a Failing Test

### 1. Run in Watch Mode

```sh
npm run test:watch
```

Vitest stays open, re-running tests on save. Easier than re-running full suite.

### 2. Use `.only` to Isolate

```js
it.only('specific test', () => {
  expect(foo()).toBe('bar');
});
```

Only this test runs. Remove `.only` after debugging.

### 3. Add Console Logs

```js
it('test', () => {
  const result = foo();
  console.log('result:', result);  // logged to terminal
  expect(result).toBe('expected');
});
```

### 4. Check Vitest Output

Vitest shows:
- Assertion error (expected vs. actual)
- File and line number
- Stack trace

---

## Coverage Goals & Roadmap

**Current**: ~90% coverage of lib.js (62 unit tests)

**Next**: 100% coverage + E2E tests for UI workflows

**By Phase**:

1. ✅ Unit tests for all lib.js functions (done)
2. ⏳ E2E tests for all tools (planned)
3. ⏳ Performance benchmarks (planned)
4. ⏳ Accessibility tests with axe-core (planned)
5. ⏳ Mobile device testing (planned)

---

## Resources

- [Vitest Docs](https://vitest.dev)
- [Playwright Docs](https://playwright.dev)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
