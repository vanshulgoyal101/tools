import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

const html = await read('index.html');
const registered = [...html.matchAll(/\btool\(\{\s*id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
const names = [...html.matchAll(/\btool\(\{\s*id:\s*'([a-z0-9-]+)',[^\n]*?name:'([^']+)'/g)]
  .map((m) => ({ id: m[1], name: m[2] }));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('documented tool count', () => {
  it('registers a unique id per tool', () => {
    expect(registered.length).toBeGreaterThan(0);
    expect(new Set(registered).size).toBe(registered.length);
  });

  // The count is quoted in prose, so it silently rots whenever a tool is added.
  it.each([
    ['README.md', /(\d+) everyday utilities/],
    ['FEATURES.md', /(\d+) utilities/],
  ])('%s quotes the real number', async (file, pattern) => {
    const match = (await read(file)).match(pattern);
    expect(match, `no count found in ${file}`).not.toBeNull();
    expect(Number(match[1]), `${file} is stale — ${registered.length} tools are registered`)
      .toBe(registered.length);
  });

  // Meta descriptions and JSON-LD are what crawlers and social cards show, and
  // one of them shipped stale at 23 while the rest said 27.
  it('quotes the real number everywhere in index.html', () => {
    const quoted = [...html.matchAll(/(\d+)\s+(?:[a-z]+\s+){0,3}utilities/gi)];
    expect(quoted.length).toBeGreaterThan(3);
    for (const match of quoted) {
      expect(Number(match[1]), `stale count in: "${match[0]}"`).toBe(registered.length);
    }
  });

  it('gives every tool its own SEO metadata', () => {
    const seo = html.slice(html.indexOf('const toolSEO'));
    const documented = new Set([...seo.matchAll(/^ {2}'?([a-z0-9-]+)'?:\s*\{/gm)].map((m) => m[1]));
    expect(registered.filter((id) => !documented.has(id))).toEqual([]);
  });

  it('lists every tool in the footer inventory', () => {
    const footer = decode(html.slice(html.indexOf('Every tool included'), html.indexOf('Frequently asked')));
    expect(names.filter(({ name }) => !footer.includes(`<b>${name}</b>`)).map((t) => t.id)).toEqual([]);
  });
});
