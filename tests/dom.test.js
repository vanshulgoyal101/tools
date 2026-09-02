import { readFile } from 'node:fs/promises';
import { describe, it, expect, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import * as lib from '../lib.js';

const indexPath = new URL('../index.html', import.meta.url);
const html = await readFile(indexPath, 'utf8');
const appSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]
  .replace(/^import[\s\S]*?from '\.\/lib\.js[^']*';\n/m, '');

if (!appSource) throw new Error('Could not locate the application module in index.html');

const doms = [];

function input(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function change(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}

async function waitFor(window, predicate, message = 'Timed out waiting for UI update') {
  for(let attempts = 0; attempts < 25; attempts++){
    if(predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  throw new Error(message);
}

function boot(hash = '', { barcodeDetector } = {}) {
  const dom = new JSDOM(html, {
    url: `https://tools.vanshul.com/${hash}`,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  doms.push(dom);

  Object.assign(window, lib, {
    TextEncoder,
    TextDecoder,
  });
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => {} },
  });
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: { register: () => Promise.resolve() },
  });
  if (!window.crypto.subtle) {
    Object.defineProperty(window.crypto, 'subtle', {
      configurable: true,
      value: globalThis.crypto.subtle,
    });
  }
  if (barcodeDetector === false) delete window.BarcodeDetector;
  else if (barcodeDetector) window.BarcodeDetector = barcodeDetector;
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillStyle: '',
    fillRect() {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,test';
  window.eval(appSource);
  return window;
}

afterEach(() => {
  while (doms.length) doms.pop().window.close();
});

describe('shipped app DOM interactions', () => {
  it('registers every navigation route and renders each synchronous tool heading', () => {
    const window = boot();
    const { document } = window;
    const routes = [...document.querySelectorAll('nav a[href^="#"]')]
      .map((link) => ({ id: link.getAttribute('href').slice(1), name: link.textContent.trim() }))
      .filter(({ id }) => id);

    expect(routes).toHaveLength(25);
    expect(routes.map(({ id }) => id)).toEqual(expect.arrayContaining(['hash', 'hmac', 'qr-reader']));
    for(const { id, name } of routes.filter(({ id }) => !['hash', 'hmac'].includes(id))){
      window.location.hash = id;
      window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      expect(document.querySelector('h1')?.textContent).toContain(name.split(/\s{2,}/).at(-1));
    }
  });

  it('renders the home grid and filters it by category', () => {
    const window = boot();
    const { document } = window;

    expect(document.querySelector('h1')?.textContent).toBe('Paste anything. It finds the tool.');
    expect(document.querySelector('.tool-count')?.textContent).toBe('25 tools');
    document.querySelector('button[data-category="Security"]')?.click();

    expect(document.querySelector('.tool-count')?.textContent).toBe('3 tools in Security');
    expect(document.querySelector('.grid')?.textContent).toContain('HMAC & CRC');
    expect(document.querySelector('.grid')?.textContent).not.toContain('JSON formatter');
  });

  it('detects Smart Paste input and links through to the full tool', () => {
    const window = boot();
    const { document } = window;
    const paste = document.querySelector('.smart textarea');
    input(window, paste, '{"id":1}');

    const card = document.querySelector('.dcard');
    expect(card?.textContent).toContain('JSON');
    expect(card?.querySelector('a')?.getAttribute('href')).toBe('#json');
  });

  it('detects a cron expression from Smart Paste and links to the cron tool', () => {
    const window = boot();
    const { document } = window;
    input(window, document.querySelector('.smart textarea'), '*/5 9-17 * * 1-5');

    const card = [...document.querySelectorAll('.dcard')].find((c) => c.textContent.includes('Cron expression'));
    expect(card).toBeDefined();
    expect(card.textContent).toMatch(/every 5 minutes/i);
    expect(card.querySelector('a').getAttribute('href')).toBe('#cron');
  });

  it('opens the command palette and routes with keyboard selection', () => {
    const window = boot();
    const { document } = window;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    const paletteInput = document.querySelector('.palette input');
    input(window, paletteInput, 'markdown');
    paletteInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));

    expect(window.location.hash).toBe('#markdown');
    expect(document.querySelector('h1')?.textContent).toContain('Markdown preview');
    expect(document.querySelector('.palette')?.classList.contains('on')).toBe(false);
  });

  it('runs route-owned JSON formatter handlers through input and click events', () => {
    const window = boot('#json');
    const { document } = window;
    const source = document.querySelector('textarea');
    input(window, source, '{"a":1}');
    document.querySelector('button.primary')?.click();

    expect(document.querySelector('[role="status"]')?.textContent).toBe('{\n  "a": 1\n}');
  });

  it('shows a JSON error then recovers when the next input is valid', () => {
    const window = boot('#json');
    const { document } = window;
    const source = document.querySelector('textarea');
    input(window, source, '{invalid');

    const output = document.querySelector('[role="status"]');
    expect(output?.classList.contains('err')).toBe(true);
    expect(output?.textContent).toContain('Invalid JSON');
    input(window, source, '{"ok":true}');

    expect(output?.classList.contains('err')).toBe(false);
    expect(output?.textContent).toContain('"ok": true');
  });

  it('updates hash digests through the asynchronous Web Crypto handler', async () => {
    const window = boot('#hash');
    const { document } = window;
    input(window, document.querySelector('textarea'), 'hello');
    await waitFor(window, () => document.querySelector('.kv')?.textContent.includes('2cf24dba5fb0a30e'));

    expect(document.querySelector('.kv')?.textContent).toContain('2cf24dba5fb0a30e');
  });

  it('updates keyed HMAC output through the asynchronous Web Crypto handler', async () => {
    const window = boot('#hmac');
    const { document } = window;
    const [message, key] = document.querySelectorAll('textarea, input[type="text"]');
    input(window, message, 'hello');
    input(window, key, 'secret');
    await waitFor(window, () => document.querySelector('.kv')?.textContent.includes('HMAC-SHA-256'));

    expect(document.querySelector('.kv')?.textContent).toContain('HMAC-SHA-256');
    expect(document.querySelector('.kv')?.textContent).toContain('88aa');
  });

  it('runs the base converter with the expected decimal defaults and live updates', () => {
    const window = boot('#base');
    const { document } = window;
    const selects = [...document.querySelectorAll('select')];
    expect(selects.map((select) => select.value)).toEqual(['10', '10']);
    change(window, selects[1], '16');

    expect(document.querySelector('[role="status"]')?.textContent).toBe('ff');
    expect(document.querySelectorAll('.kv')[0]?.textContent).toContain('Binary');
  });

  it('renders Markdown in the live preview using the route handler', () => {
    const window = boot('#markdown');
    const { document } = window;
    input(window, document.querySelector('textarea'), '# Notes\n\n- first');

    const preview = document.querySelector('[role="region"]');
    expect(preview?.querySelector('h1')?.textContent).toBe('Notes');
    expect(preview?.querySelector('li')?.textContent).toBe('first');
  });

  it('keeps QR image scanning local and explains unsupported browsers', () => {
    const window = boot('#qr-reader', { barcodeDetector: false });
    const { document } = window;
    const chooseImage = document.querySelector('button.primary');
    const note = document.querySelector('.btnrow + .sub');

    expect(chooseImage?.disabled).toBe(true);
    expect(note?.classList.contains('err')).toBe(true);
    expect(note?.textContent).toContain('BarcodeDetector API');
    expect(document.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('uses the native QR detector for a selected local image when supported', async () => {
    class FakeBarcodeDetector {
      constructor(options) { expect(options).toEqual({ formats: ['qr_code'] }); }
      async detect() { return [{ rawValue: 'https://tools.vanshul.com' }]; }
    }
    const window = boot('#qr-reader', { barcodeDetector: FakeBarcodeDetector });
    const { document } = window;
    let revokedUrl = '';
    window.URL.createObjectURL = () => 'blob:local-qr';
    window.URL.revokeObjectURL = (url) => { revokedUrl = url; };
    window.Image = class {
      set src(url) { this._src = url; this.onload?.(); }
    };
    const file = document.querySelector('input[type="file"]');
    Object.defineProperty(file, 'files', { value: [{ type: 'image/png' }] });
    file.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(document.querySelector('[role="status"]')?.textContent).toBe('https://tools.vanshul.com');
    expect(document.querySelector('.image-preview')?.getAttribute('src')).toBe('blob:local-qr');
    expect(revokedUrl).toBe('blob:local-qr');
  });

  it('encodes and decodes Base32 through the tool buttons', () => {
    const window = boot('#base32');
    const { document } = window;
    const source = document.querySelector('textarea');
    const output = document.querySelector('[role="status"]');

    source.value = 'foobar';
    document.querySelector('button.primary').click();
    expect(output.textContent).toBe('MZXW6YTBOI======');

    source.value = 'MZXW6YTBOI======';
    [...document.querySelectorAll('button')].find((b) => b.textContent === '← Decode').click();
    expect(output.textContent).toBe('foobar');
  });

  it('exposes click-to-copy values as keyboard-reachable buttons', async () => {
    const window = boot('#color');
    const { document } = window;
    const cells = document.querySelectorAll('.kv button.copycell');
    expect(cells.length).toBeGreaterThan(0);

    cells[0].click();
    await waitFor(window, () => cells[0].textContent === 'Copied ✓');
    expect(cells[0].textContent).toBe('Copied ✓');
  });

  it('escapes and unescapes HTML through the Escape tool buttons', () => {
    const window = boot('#escape');
    const { document } = window;
    const source = document.querySelector('textarea');
    const output = document.querySelector('[role="status"]');
    source.value = '<b>Tom & Jerry</b>';
    document.querySelector('button.primary').click();
    expect(output.textContent).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');

    source.value = '&lt;i&gt;x&lt;/i&gt;';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'HTML unescape').click();
    expect(output.textContent).toBe('<i>x</i>');
  });

  it('surfaces an unescape failure as an error instead of throwing', () => {
    const window = boot('#escape');
    const { document } = window;
    document.querySelector('textarea').value = 'bad \\q';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'JS unescape').click();

    const output = document.querySelector('[role="status"]');
    expect(output.classList.contains('err')).toBe(true);
    expect(output.textContent).toMatch(/valid escaped string/i);
  });

  it('warns about catastrophic regex patterns but still reports matches', () => {
    const window = boot('#regex');
    const { document } = window;
    const [pattern] = document.querySelectorAll('input[type="text"]');
    const warning = document.querySelector('.warn');

    input(window, pattern, '\\d+');
    expect(warning.style.display).toBe('none');

    input(window, document.querySelector('textarea'), 'a1 b22');
    input(window, pattern, '(a+)+$');
    expect(warning.style.display).toBe('');
    expect(warning.textContent).toMatch(/backtrack/i);
    expect(document.querySelector('.kv').textContent).toContain('Matches');
  });

  it('toggles the colour theme and remembers the choice', () => {
    const window = boot();
    const { document } = window;
    const toggle = document.getElementById('theme-toggle');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    toggle.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('tools-theme')).toBe('light');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#f5f7fc');

    toggle.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('lists recently used tools on the home screen', () => {
    const window = boot('#markdown');
    const { document } = window;
    expect(window.localStorage.getItem('tools-recent')).toContain('markdown');

    window.location.hash = '';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));

    const labels = [...document.querySelectorAll('.section-label')].map((h) => h.textContent);
    expect(labels).toContain('Recently used');
    expect(document.querySelector('a.category[href="#markdown"]')).not.toBeNull();
  });

  it('falls back to the home screen for an unknown route', () => {
    const window = boot('#missing-tool');
    expect(window.document.querySelector('h1')?.textContent).toBe('Paste anything. It finds the tool.');
    expect(window.document.querySelector('nav a.active')?.dataset.home).toBe('1');
  });

  it('updates SEO metadata and active navigation for a known route', () => {
    const window = boot('#base64');
    const { document } = window;

    expect(document.title).toContain('Base64 Encoder & Decoder');
    expect(document.querySelector('meta[name="description"]')?.content).toContain('UTF-8 safe');
    expect(document.querySelector('link[rel="canonical"]')?.href).toBe('https://tools.vanshul.com/#base64');
    expect(document.querySelector('nav a.active')?.getAttribute('href')).toBe('#base64');
    expect(document.getElementById('breadcrumb-schema')?.textContent).toContain('Base64');
  });

  it('dismisses the command palette with Escape without changing the route', () => {
    const window = boot();
    const { document } = window;
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    const palette = document.querySelector('.palette');
    const paletteInput = document.querySelector('.palette input');
    paletteInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(palette?.classList.contains('on')).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('moves focus into the palette, retains Tab focus, and restores its trigger', async () => {
    const window = boot();
    const { document } = window;
    const trigger = document.querySelector('nav a[href="#json"]');
    trigger.focus();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    const paletteInput = document.querySelector('.palette input');
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(document.activeElement).toBe(paletteInput);
    paletteInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(paletteInput);
    paletteInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(trigger);
  });
});