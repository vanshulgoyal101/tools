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

  test('Base converter: converts decimal to hex', async ({ page }) => {
    await gotoTool(page, 'base');
    await page.getByLabel('Value').fill('255');
    await page.getByLabel('From base').selectOption('10');
    await page.getByLabel('To base').selectOption('16');
    await expect(page.getByLabel('Converted result')).toHaveText('ff');
    await expect(page.getByLabel('Quick views')).toContainText('Binary');
  });

  test('Markdown preview: renders a heading and list', async ({ page }) => {
    await gotoTool(page, 'markdown');
    await page.getByLabel('Markdown').fill('# Notes\n\n- first');
    await expect(page.getByLabel('Preview').locator('h1')).toHaveText('Notes');
    await expect(page.getByLabel('Preview').locator('li')).toHaveText('first');
  });

  test('Image data URI: reads a local image without upload', async ({ page }) => {
    await gotoTool(page, 'datauri');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLjdQAAAABJRU5ErkJggg==', 'base64'),
    });
    await expect(page.getByLabel('Image details')).toContainText('image/png');
    await expect(page.getByLabel('Data URI')).toContainText('data:image/png;base64,');
    await expect(page.locator('.image-preview')).toBeVisible();
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

  test('QR reader: gives a clear browser-support state', async ({ page }) => {
    await gotoTool(page, 'qr-reader');
    const supported = await page.evaluate(() => 'BarcodeDetector' in window);
    const chooseImage = page.getByRole('button', { name: 'Choose QR image' });
    if(supported) await expect(chooseImage).toBeEnabled();
    else {
      await expect(chooseImage).toBeDisabled();
      await expect(page.locator('.sub.err')).toContainText('BarcodeDetector API');
    }
  });

  test('Base32: encodes text using RFC 4648', async ({ page }) => {
    await gotoTool(page, 'base32');
    await page.getByLabel('Input').fill('foobar');
    await page.getByRole('button', { name: 'Encode' }).click();
    await expect(page.getByLabel('Output')).toHaveText('MZXW6YTBOI======');
  });

  test('Copy cells: are focusable and activate with the keyboard', async ({ page }) => {
    await gotoTool(page, 'color');
    const cell = page.locator('.kv button.copycell').first();
    const label = page.locator('.kv .k').first();
    const cellBox = await cell.boundingBox();
    const labelBox = await label.boundingBox();
    expect(cellBox.x).toBeGreaterThan(labelBox.x);
    expect(Math.abs(cellBox.y - labelBox.y)).toBeLessThan(24);

    await cell.focus();
    await expect(cell).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cell).toHaveText(/Copied|Copy failed/);
  });

  test('Escape tool: escapes HTML entities', async ({ page }) => {
    await gotoTool(page, 'escape');
    await page.getByLabel('Input').fill('<b>Tom & Jerry</b>');
    await page.getByRole('button', { name: 'HTML escape' }).click();
    await expect(page.getByLabel('Output')).toHaveText('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  test('Regex tester: warns about catastrophic backtracking', async ({ page }) => {
    await gotoTool(page, 'regex');
    await page.getByLabel('Pattern').fill('(a+)+$');
    await expect(page.locator('.warn')).toBeVisible();
    await expect(page.locator('.warn')).toContainText('backtrack');
  });

  test('Theme: toggles and survives a reload', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('html');
    const before = await root.getAttribute('data-theme');
    await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click();
    const after = await root.getAttribute('data-theme');
    expect(after).not.toBe(before);
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', after);
  });

  test('Smart Paste: detects JSON on home', async ({ page }) => {
    await page.goto('/');
    await page.locator('.smart textarea').fill('{"id":1}');
    await expect(page.locator('.dcard .t', { hasText: 'JSON' })).toBeVisible();
  });

  test('Home: filters the grid by category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Security' }).click();
    await expect(page.locator('.tool-count')).toHaveText('3 tools in Security');
    await expect(page.locator('.grid')).toContainText('HMAC & CRC');
    await expect(page.locator('.grid')).not.toContainText('JSON formatter');
  });

  test('Smart Paste: detects a cron expression', async ({ page }) => {
    await page.goto('/');
    await page.locator('.smart textarea').fill('*/5 9-17 * * 1-5');
    await expect(page.locator('.dcard .t', { hasText: 'Cron expression' })).toBeVisible();
  });

  test('Command palette: jump to base64', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('.palette.on')).toBeVisible();
    await page.locator('.palette input').fill('base64');
    await page.locator('.palette input').press('Enter');
    await expect(page).toHaveURL(/#base64$/);
  });

  test('Command palette: contains focus and restores its trigger', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('nav a[href="#json"]');
    await trigger.focus();
    await page.keyboard.press('Control+k');
    const paletteInput = page.locator('.palette input');
    await expect(paletteInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(paletteInput).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('Skip link: is keyboard-visible and targets main content', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main');
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
