import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

const html = await read('index.html');
const registered = [...html.matchAll(/\btool\(\{\s*id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);

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
});
