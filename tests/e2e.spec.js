import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080'; // Update to your local dev server port

test.describe('tools.vanshul.com E2E Tests', () => {
  
  // ============ JSON Tool ============
  test('JSON: Format button pretty-prints JSON', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    await page.fill('textarea', '{"a":1,"b":2}');
    await page.click('button:has-text("Format")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('"a"');
    expect(output).toContain('"b"');
  });

  test('JSON: Minify button removes whitespace', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    await page.fill('textarea', '{\n  "key": "value"\n}');
    await page.click('button:has-text("Minify")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toBe('{"key":"value"}');
  });

  test('JSON: Copy button copies output', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    await page.fill('textarea', '{"test":true}');
    await page.click('button:has-text("Format")');
    await page.click('button:has-text("Copy")');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('"test"');
  });

  test('JSON: Validation shows errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    await page.fill('textarea', '{invalid json}');
    await page.click('button:has-text("Format")');
    const error = await page.locator('.out.err').textContent();
    expect(error).toBeTruthy();
  });

  // ============ Base64 Tool ============
  test('Base64: Encode text to Base64', async ({ page }) => {
    await page.goto(`${BASE_URL}/#base64`);
    await page.fill('textarea', 'hello');
    await page.click('button:has-text("Encode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toBe('aGVsbG8=');
  });

  test('Base64: Decode Base64 to text', async ({ page }) => {
    await page.goto(`${BASE_URL}/#base64`);
    await page.fill('textarea', 'aGVsbG8=');
    await page.click('button:has-text("Decode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toBe('hello');
  });

  test('Base64: UTF-8 emoji encoding', async ({ page }) => {
    await page.goto(`${BASE_URL}/#base64`);
    await page.fill('textarea', '🚀');
    await page.click('button:has-text("Encode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toBeTruthy();
    expect(output).not.toBe('🚀');
  });

  // ============ URL Tool ============
  test('URL: Encode text to URL safe format', async ({ page }) => {
    await page.goto(`${BASE_URL}/#url`);
    await page.fill('textarea', 'hello world & special=chars');
    await page.click('button:has-text("Encode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('%');
  });

  test('URL: Decode URL encoded text', async ({ page }) => {
    await page.goto(`${BASE_URL}/#url`);
    await page.fill('textarea', 'hello%20world');
    await page.click('button:has-text("Decode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('hello world');
  });

  test('URL: Parse query string shows table', async ({ page }) => {
    await page.goto(`${BASE_URL}/#url`);
    await page.fill('textarea', 'key1=value1&key2=value2');
    await page.click('button:has-text("Parse query")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('key1');
    expect(output).toContain('value1');
  });

  // ============ JWT Tool ============
  test('JWT: Decode valid token shows header, payload, signature', async ({ page }) => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    await page.goto(`${BASE_URL}/#jwt`);
    await page.fill('textarea', token);
    await page.click('button:has-text("Decode")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('header');
    expect(output).toContain('payload');
  });

  test('JWT: Invalid token shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/#jwt`);
    await page.fill('textarea', 'not.a.token');
    await page.click('button:has-text("Decode")');
    const error = await page.locator('.out.err').textContent();
    expect(error).toBeTruthy();
  });

  // ============ Hash Tool ============
  test('Hash: SHA-256 of text produces correct hash', async ({ page }) => {
    await page.goto(`${BASE_URL}/#hash`);
    const hashSelect = await page.locator('select');
    await hashSelect.selectOption('SHA-256');
    await page.fill('textarea', 'hello');
    await page.click('button:has-text("Hash")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output.toLowerCase()).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  // ============ ID Tool ============
  test('ID: Generate UUID v4', async ({ page }) => {
    await page.goto(`${BASE_URL}/#id`);
    const idSelect = await page.locator('select');
    await idSelect.selectOption('UUID v4');
    await page.click('button:has-text("Generate")');
    const output = await page.locator('.out').textContent();
    const uuidv4Regex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
    expect(output).toMatch(uuidv4Regex);
  });

  test('ID: Generate UUID v7 (time-sortable)', async ({ page }) => {
    await page.goto(`${BASE_URL}/#id`);
    const idSelect = await page.locator('select');
    await idSelect.selectOption('UUID v7');
    await page.click('button:has-text("Generate")');
    const output = await page.locator('.out').textContent();
    expect(output).toMatch(/[0-9a-f-]/i);
  });

  test('ID: Generate password with custom length', async ({ page }) => {
    await page.goto(`${BASE_URL}/#id`);
    const idSelect = await page.locator('select');
    await idSelect.selectOption('Password');
    const input = await page.locator('input[type="number"]');
    await input.fill('20');
    await page.click('button:has-text("Generate")');
    const output = await page.locator('.out').textContent();
    expect(output.length).toBeGreaterThanOrEqual(16); // at least 16 chars
  });

  // ============ Timestamp Tool ============
  test('Timestamp: Convert Unix timestamp to date', async ({ page }) => {
    await page.goto(`${BASE_URL}/#time`);
    await page.fill('textarea', '1672531200'); // Jan 1, 2023
    await page.click('button:has-text("Parse")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('2023');
  });

  test('Timestamp: Convert date to Unix timestamp', async ({ page }) => {
    await page.goto(`${BASE_URL}/#time`);
    await page.fill('textarea', '2023-01-01');
    await page.click('button:has-text("Parse")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('1672531200');
  });

  // ============ Color Tool ============
  test('Color: Convert HEX to RGB', async ({ page }) => {
    await page.goto(`${BASE_URL}/#color`);
    await page.fill('textarea', '#FF0000');
    await page.click('button:has-text("Parse")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('255');
    expect(output).toContain('0');
  });

  test('Color: Swatch displays correct color', async ({ page }) => {
    await page.goto(`${BASE_URL}/#color`);
    await page.fill('textarea', '#00FF00');
    await page.click('button:has-text("Parse")');
    const swatch = await page.locator('div.swatch');
    const bgColor = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('0'); // Green
  });

  // ============ Text Tool ============
  test('Text: Count words and characters', async ({ page }) => {
    await page.goto(`${BASE_URL}/#text`);
    await page.fill('textarea', 'hello world');
    const stats = await page.locator('.out').textContent();
    expect(stats).toContain('2'); // 2 words
    expect(stats).toContain('11'); // 11 chars (with space)
  });

  test('Text: Convert to uppercase', async ({ page }) => {
    await page.goto(`${BASE_URL}/#text`);
    await page.fill('textarea', 'hello');
    await page.click('button:has-text("UPPER")');
    const output = await page.locator('.out').textContent();
    expect(output).toBe('HELLO');
  });

  test('Text: Convert to lowercase', async ({ page }) => {
    await page.goto(`${BASE_URL}/#text`);
    await page.fill('textarea', 'HELLO');
    await page.click('button:has-text("lower")');
    const output = await page.locator('.out').textContent();
    expect(output).toBe('hello');
  });

  // ============ Diff Tool ============
  test('Diff: Show line-by-line differences', async ({ page }) => {
    await page.goto(`${BASE_URL}/#diff`);
    await page.fill('textarea[placeholder*="First"]', 'hello\nworld');
    await page.fill('textarea[placeholder*="Second"]', 'hello\nplanet');
    await page.click('button:has-text("Diff")');
    const output = await page.locator('.out').textContent();
    expect(output).toContain('world') || expect(output).toContain('planet');
  });

  // ============ Regex Tool ============
  test('Regex: Highlight matches', async ({ page }) => {
    await page.goto(`${BASE_URL}/#regex`);
    await page.fill('input[placeholder*="pattern"]', '\\d+');
    await page.fill('textarea', 'abc123def456');
    const matches = await page.locator('.out').textContent();
    expect(matches).toContain('123') || expect(matches).toContain('456');
  });

  // ============ Tokens Tool ============
  test('Tokens: Estimate token count', async ({ page }) => {
    await page.goto(`${BASE_URL}/#tokens`);
    await page.fill('textarea', 'This is a sample text for token counting.');
    const output = await page.locator('.out').textContent();
    expect(output).toMatch(/\d+/); // Should contain a number
  });

  // ============ Cron Tool ============
  test('Cron: Parse and describe cron expression', async ({ page }) => {
    await page.goto(`${BASE_URL}/#cron`);
    await page.fill('textarea', '*/5 * * * *');
    await page.click('button:has-text("Parse")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output.toLowerCase()).toContain('5 minute');
  });

  test('Cron: Show next runs', async ({ page }) => {
    await page.goto(`${BASE_URL}/#cron`);
    await page.fill('textarea', '0 9 * * 1-5');
    await page.click('button:has-text("Next runs")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toMatch(/\d{1,2}:\d{2}/); // Should contain time
  });

  // ============ YAML Tool ============
  test('YAML: Convert JSON to YAML', async ({ page }) => {
    await page.goto(`${BASE_URL}/#yaml`);
    await page.fill('textarea', '{"name":"John","age":30}');
    await page.click('button:has-text("JSON → YAML")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('name:');
    expect(output).toContain('John');
  });

  test('YAML: Convert YAML to JSON', async ({ page }) => {
    await page.goto(`${BASE_URL}/#yaml`);
    await page.fill('textarea', 'name: John\nage: 30');
    await page.click('button:has-text("YAML → JSON")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('"name"');
  });

  // ============ JSON-to-TypeScript Tool ============
  test('JSON tools: Generate TypeScript type', async ({ page }) => {
    await page.goto(`${BASE_URL}/#jsonts`);
    const modeSelect = await page.locator('select').first();
    await modeSelect.selectOption('TypeScript');
    await page.fill('textarea', '{"id":1,"name":"test"}');
    await page.click('button:has-text("Generate")');
    const output = await page.locator('.out:not(.err)').textContent();
    expect(output).toContain('interface') || expect(output).toContain('type');
  });

  test('JSON tools: Sort keys', async ({ page }) => {
    await page.goto(`${BASE_URL}/#jsonts`);
    const modeSelect = await page.locator('select').first();
    await modeSelect.selectOption('Sort keys');
    await page.fill('textarea', '{"z":1,"a":2}');
    await page.click('button:has-text("Sort")');
    const output = await page.locator('.out:not(.err)').textContent();
    const indexOfA = output.indexOf('"a"');
    const indexOfZ = output.indexOf('"z"');
    expect(indexOfA).toBeLessThan(indexOfZ);
  });

  // ============ cURL Tool ============
  test('cURL: Convert cURL to Fetch', async ({ page }) => {
    await page.goto(`${BASE_URL}/#curl`);
    await page.fill('textarea', 'curl -X POST https://example.com -H "Content-Type: application/json" -d {"key":"value"}');
    await page.click('button:has-text("Copy fetch")');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('fetch');
  });

  test('cURL: Convert cURL to Python', async ({ page }) => {
    await page.goto(`${BASE_URL}/#curl`);
    await page.fill('textarea', 'curl https://example.com');
    await page.click('button:has-text("Copy Python")');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('python') || expect(clipboardText).toContain('requests');
  });

  // ============ Transform Tool ============
  test('Transform: Sort lines', async ({ page }) => {
    await page.goto(`${BASE_URL}/#transform`);
    const modeSelect = await page.locator('select').first();
    await modeSelect.selectOption('Sort');
    await page.fill('textarea', 'zebra\napple\nbanana');
    await page.click('button:has-text("Go")');
    const output = await page.locator('.out').textContent();
    const indexOfA = output.indexOf('apple');
    const indexOfZ = output.indexOf('zebra');
    expect(indexOfA).toBeLessThan(indexOfZ);
  });

  test('Transform: Deduplicate lines', async ({ page }) => {
    await page.goto(`${BASE_URL}/#transform`);
    const modeSelect = await page.locator('select').first();
    await modeSelect.selectOption('Dedupe');
    await page.fill('textarea', 'a\nb\na\nc');
    await page.click('button:has-text("Go")');
    const output = await page.locator('.out').textContent();
    expect(output).not.toContain('a\na');
  });

  // ============ HMAC Tool ============
  test('HMAC: Generate HMAC-SHA256', async ({ page }) => {
    await page.goto(`${BASE_URL}/#hmac`);
    const algoSelect = await page.locator('select').first();
    await algoSelect.selectOption('HMAC-SHA256');
    await page.fill('input[placeholder*="Message"]', 'hello');
    await page.fill('input[placeholder*="Key"]', 'secret');
    await page.click('button:has-text("Sign")');
    const output = await page.locator('.out').textContent();
    expect(output).toMatch(/[0-9a-f]{64}/i); // 64 hex chars for SHA256
  });

  // ============ QR Tool ============
  test('QR: Generate QR code', async ({ page }) => {
    await page.goto(`${BASE_URL}/#qr`);
    await page.fill('textarea', 'https://example.com');
    await page.click('button:has-text("Generate")');
    const canvas = await page.locator('canvas.qr');
    const isVisible = await canvas.isVisible();
    expect(isVisible).toBe(true);
  });

  // ============ Smart Paste ============
  test('Smart Paste: Detect JSON', async ({ page }) => {
    await page.goto(`${BASE_URL}`); // Home page
    await page.fill('textarea', '{"test":true}');
    const card = await page.locator('.dcard:has-text("JSON")');
    const isVisible = await card.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Smart Paste: Detect UUID', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    await page.fill('textarea', uuid);
    const card = await page.locator('.dcard:has-text("UUID")');
    const isVisible = await card.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Smart Paste: Detect Base64', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    await page.fill('textarea', 'aGVsbG8gd29ybGQ=');
    const card = await page.locator('.dcard:has-text("Base64")');
    const isVisible = await card.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Smart Paste: Detect hex color', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    await page.fill('textarea', '#FF5733');
    const card = await page.locator('.dcard:has-text("Color")');
    const isVisible = await card.isVisible();
    expect(isVisible).toBe(true);
  });

  // ============ Command Palette ============
  test('Command Palette: Search and navigate to JSON tool', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    await page.press('body', 'Control+K');
    const palette = await page.locator('.palette');
    const isVisible = await palette.isVisible();
    expect(isVisible).toBe(true);

    await page.type('.palette input', 'json');
    await page.press('.palette input', 'ArrowDown');
    await page.press('.palette input', 'Enter');
    expect(page.url()).toContain('#json');
  });

  test('Command Palette: Close with Escape', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    await page.press('body', 'Control+K');
    await page.press('body', 'Escape');
    const palette = await page.locator('.palette.on');
    const isVisible = await palette.isVisible();
    expect(isVisible).toBe(false);
  });

  // ============ Navigation ============
  test('Navigation: Sidebar links work', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    const link = await page.locator('a:has-text("JSON")');
    await link.click();
    expect(page.url()).toContain('#json');
  });

  test('Navigation: Home link returns to all tools', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    const homeLink = await page.locator('a[data-home="1"]');
    await homeLink.click();
    expect(page.url()).toContain('/');
    expect(page.url()).not.toContain('#');
  });

  // ============ Offline (PWA) ============
  test('PWA: Service worker registers', async ({ page }) => {
    await page.goto(`${BASE_URL}`);
    const registration = await page.evaluate(() => navigator.serviceWorker.getRegistration());
    expect(registration).toBeTruthy();
  });

  // ============ Keyboard Navigation ============
  test('Keyboard: Tab through tool inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    const textarea = await page.locator('textarea').first();
    await textarea.focus();
    await page.press('body', 'Tab');
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['SELECT', 'BUTTON']).toContain(focusedElement);
  });

  // ============ Mobile Responsiveness ============
  test('Mobile: Page loads on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.goto(`${BASE_URL}/#json`);
    const textarea = await page.locator('textarea').first();
    const isVisible = await textarea.isVisible();
    expect(isVisible).toBe(true);
  });

  // ============ Error Handling ============
  test('Error: Invalid JSON shows error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    await page.fill('textarea', '{invalid}');
    await page.click('button:has-text("Format")');
    const error = await page.locator('.out.err');
    const isVisible = await error.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Error: Large input shows error or handles gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/#json`);
    const largeInput = '{"key":"' + 'x'.repeat(10000) + '"}';
    await page.fill('textarea', largeInput);
    await page.click('button:has-text("Format")');
    const output = await page.locator('.out');
    const isVisible = await output.isVisible();
    expect(isVisible).toBe(true); // Should handle large input without crash
  });
});
