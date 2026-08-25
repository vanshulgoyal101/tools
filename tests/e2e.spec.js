import { test, expect } from '@playwright/test';

const jwtSample =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

async function gotoTool(page, id) {
  await page.goto(`/#${id}`);
  await expect(page.locator('h1')).toBeVisible();
}

test.describe('Tools E2E smoke', () => {
  test('JSON formatter: format and minify', async ({ page }) => {
    await gotoTool(page, 'json');
    await page.getByLabel('Input').fill('{"b":2,"a":1}');
    await page.getByRole('button', { name: 'Format' }).click();
    await expect(page.locator('.out')).toContainText('"a": 1');
    await page.getByRole('button', { name: 'Minify' }).click();
    await expect(page.locator('.out')).toHaveText('{"b":2,"a":1}');
  });

  test('Base64: encode and decode', async ({ page }) => {
    await gotoTool(page, 'base64');
    await page.getByLabel('Input').fill('hello');
    await page.getByRole('button', { name: 'Encode' }).click();
    await expect(page.locator('.out')).toHaveText('aGVsbG8=');
    await page.getByLabel('Input').fill('aGVsbG8=');
    await page.getByRole('button', { name: 'Decode' }).click();
    await expect(page.locator('.out')).toHaveText('hello');
  });

  test('URL: parse query parameters', async ({ page }) => {
    await gotoTool(page, 'url');
    await page.getByLabel('Input').fill('https://x.dev/?a=1&b=hello+world');
    await page.getByRole('button', { name: 'Parse query' }).click();
    await expect(page.locator('.kv')).toContainText('a');
    await expect(page.locator('.kv')).toContainText('hello world');
  });

  test('JWT decoder: decode valid token', async ({ page }) => {
    await gotoTool(page, 'jwt');
    await page.getByLabel('Token').fill(jwtSample);
    await expect(page.locator('.out').first()).toContainText('"alg": "HS256"');
    await expect(page.locator('.out').nth(1)).toContainText('"sub": "1234567890"');
  });

  test('Hash: computes SHA-256 digest', async ({ page }) => {
    await gotoTool(page, 'hash');
    await page.getByLabel('Input').fill('hello');
    await expect(page.locator('.kv')).toContainText('SHA-256');
    await expect(page.locator('.kv')).toContainText('2cf24dba5fb0a30e');
  });

  test('ID generator: uuid v7 and count', async ({ page }) => {
    await gotoTool(page, 'id');
    await page.getByLabel('Type').selectOption('uuid7');
    await page.getByLabel('How many').fill('3');
    await page.getByRole('button', { name: 'Generate' }).click();
    const text = await page.locator('.out').textContent();
    const lines = (text || '').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(lines[0][14]).toBe('7');
  });

  test('Timestamp: parses unix seconds', async ({ page }) => {
    await gotoTool(page, 'time');
    await page.getByLabel('From Unix timestamp').fill('1672531200');
    await expect(page.locator('.kv')).toContainText('2023-01-01T00:00:00.000Z');
  });

  test('Color: parses hex and shows RGB', async ({ page }) => {
    await gotoTool(page, 'color');
    await page.getByLabel('Colour (hex, rgb or hsl)').fill('#ff0000');
    await expect(page.locator('.kv')).toContainText('rgb(255, 0, 0)');
  });

  test('Text: stats and uppercase', async ({ page }) => {
    await gotoTool(page, 'text');
    await page.getByLabel('Input').fill('hello world');
    await expect(page.locator('.pill', { hasText: 'Characters: 11' })).toBeVisible();
    await expect(page.locator('.pill', { hasText: 'Words: 2' })).toBeVisible();
    await page.getByRole('button', { name: 'UPPER' }).click();
    await expect(page.locator('.out')).toHaveText('HELLO WORLD');
  });

  test('Diff: marks additions and deletions', async ({ page }) => {
    await gotoTool(page, 'diff');
    await page.getByLabel('Original').fill('a\nb');
    await page.getByLabel('Changed').fill('a\nc');
    await expect(page.locator('.out')).toContainText('- b');
    await expect(page.locator('.out')).toContainText('+ c');
  });

  test('Regex tester: counts matches', async ({ page }) => {
    await gotoTool(page, 'regex');
    await page.getByLabel('Pattern').fill('\\d+');
    await page.getByLabel('Flags').fill('g');
    await page.getByLabel('Test string').fill('a1 b22');
    await expect(page.locator('.kv')).toContainText('Matches');
    await expect(page.locator('.kv')).toContainText('2');
  });

  test('Token estimator: outputs estimate rows', async ({ page }) => {
    await gotoTool(page, 'tokens');
    await page.getByLabel('Text').fill('This is a sample sentence for token counting.');
    await expect(page.locator('.kv')).toContainText('Est. tokens');
    await expect(page.locator('.kv')).toContainText('Input cost');
  });

  test('Cron: summary and next runs', async ({ page }) => {
    await gotoTool(page, 'cron');
    await page.getByLabel('Cron expression').fill('*/5 * * * *');
    await expect(page.locator('.out').first()).toContainText('Every 5 minutes');
    await expect(page.locator('.out').nth(1)).not.toBeEmpty();
  });

  test('JSON <-> YAML: convert both directions', async ({ page }) => {
    await gotoTool(page, 'yaml');
    await page.getByLabel('Input').fill('{"name":"John"}');
    await page.getByRole('button', { name: 'JSON → YAML' }).click();
    await expect(page.locator('.out')).toContainText('name: John');
    await page.getByLabel('Input').fill('name: John');
    await page.getByRole('button', { name: 'YAML → JSON' }).click();
    await expect(page.locator('.out')).toContainText('"name": "John"');
  });

  test('JSON tools: TypeScript and query', async ({ page }) => {
    await gotoTool(page, 'jsonts');
    await page.getByLabel('JSON').fill('{"user":{"name":"Ada"}}');
    await page.getByRole('button', { name: '→ TypeScript' }).click();
    await expect(page.locator('.out')).toContainText('type Root =');
    await page.getByLabel('Query path').fill('user.name');
    await page.getByRole('button', { name: 'Run query' }).click();
    await expect(page.locator('.out')).toContainText('"Ada"');
  });

  test('cURL tool: emits fetch and python snippets', async ({ page }) => {
    await gotoTool(page, 'curl');
    await page
      .getByLabel('curl command')
      .fill("curl -X POST https://example.com -H 'Content-Type: application/json' -d '{\"a\":1}'");
    await expect(page.locator('.out').first()).toContainText('fetch(');
    await expect(page.locator('.out').nth(1)).toContainText('requests.request');
  });

  test('Transform: dedupe lines', async ({ page }) => {
    await gotoTool(page, 'transform');
    await page.getByLabel('Input').fill('a\nb\na');
    await page.getByRole('button', { name: 'Dedupe' }).click();
    await expect(page.locator('.out')).toHaveText('a\nb');
  });

  test('HMAC & CRC: generates both rows with key', async ({ page }) => {
    await gotoTool(page, 'hmac');
    await page.getByLabel('Message').fill('hello');
    await page.getByLabel('Key').fill('secret');
    await expect(page.locator('.kv')).toContainText('CRC32');
    await expect(page.locator('.kv')).toContainText('HMAC-SHA-256');
  });

  test('QR: renders canvas', async ({ page }) => {
    await gotoTool(page, 'qr');
    await page.getByLabel('Content').fill('https://example.com');
    await expect(page.locator('canvas.qr')).toBeVisible();
  });

  test('Smart Paste: detects JSON on home', async ({ page }) => {
    await page.goto('/');
    await page.locator('.smart textarea').fill('{"id":1}');
    await expect(page.locator('.dcard .t', { hasText: 'JSON' })).toBeVisible();
  });

  test('Command palette: jump to base64', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('.palette.on')).toBeVisible();
    await page.locator('.palette input').fill('base64');
    await page.locator('.palette input').press('Enter');
    await expect(page).toHaveURL(/#base64$/);
  });

  test('Navigation: home to JSON route', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav a[href="#json"]').click();
    await expect(page).toHaveURL(/#json$/);
  });

  test('PWA: service worker API available', async ({ page }) => {
    await page.goto('/');
    const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(hasSW).toBe(true);
  });

  test('Mobile viewport: JSON tool input visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoTool(page, 'json');
    await expect(page.getByLabel('Input')).toBeVisible();
  });
});
