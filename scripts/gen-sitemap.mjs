#!/usr/bin/env node
// gen-sitemap.mjs — zero-dependency sitemap + robots generator.
//
// Reads ./sitemap.config.json (repo root), scans the publish directory for
// HTML files, maps them to URLs, and writes <scanDir>/<outFile> plus keeps
// robots.txt pointing at the sitemap. Run from the repo root:
//
//     node scripts/gen-sitemap.mjs            # scan local files (default)
//     node scripts/gen-sitemap.mjs --crawl    # also crawl the live site
//
// Config (all optional except baseUrl):
//   baseUrl            "https://tools.vanshul.com"
//   scanDir            "."            directory to scan / write into
//   outFile            "sitemap.xml"  written inside scanDir
//   include            ["index.html"] glob(s) of files to include (** and *)
//   exclude            [...]          glob(s) to skip
//   extraRoutes        ["/", "/x"]    always-included absolute paths
//   routesFrom         "path.js"      ES module exporting `routes: string[]`
//   defaultChangefreq  "monthly"
//   updateRobots       true           keep robots.txt Sitemap: line in sync
//   crawlUrl           baseUrl        origin to crawl when --crawl is passed
//   maxCrawl           200            crawl page budget

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CONFIG_PATH = 'sitemap.config.json';
if (!existsSync(CONFIG_PATH)) { console.error(`✗ ${CONFIG_PATH} not found (run from the repo root).`); process.exit(1); }
const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
if (!cfg.baseUrl) { console.error('✗ baseUrl is required in sitemap.config.json'); process.exit(1); }

const BASE = cfg.baseUrl.replace(/\/+$/, '');
const scanDir = cfg.scanDir ?? '.';
const outFile = cfg.outFile ?? 'sitemap.xml';
const include = cfg.include ?? ['**/*.html'];
const exclude = cfg.exclude ?? ['**/404.html', '**/node_modules/**', '**/.git/**'];
const defaultChangefreq = cfg.defaultChangefreq ?? 'monthly';
const updateRobots = cfg.updateRobots !== false;
const doCrawl = process.argv.includes('--crawl');

/* -------- tiny glob matcher (supports **, *, ?) -------- */
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') i++; re += '(?:.*/)?'; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}
const matchers = (globs) => globs.map(globToRe);
const anyMatch = (res, p) => res.some((r) => r.test(p));
const incRes = matchers(include), excRes = matchers(exclude);

/* -------- walk the publish dir -------- */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const relPosix = (p) => relative(scanDir, p).split(/[\\/]/).join('/');

/* -------- file -> URL -------- */
function fileToUrl(rel) {
  if (basename(rel) === 'index.html') {
    let dir = rel.slice(0, -'index.html'.length).replace(/\/+$/, '');
    return BASE + '/' + (dir ? dir + '/' : '');
  }
  return BASE + '/' + rel.replace(/\.html$/, '');
}

function gitDate(file) {
  try {
    const d = execSync(`git log -1 --format=%cs -- "${file}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return d || null;
  } catch { return null; }
}
const today = new Date().toISOString().slice(0, 10);

function priorityFor(url) {
  const path = url.slice(BASE.length).replace(/^\/|\/$/g, '');
  if (path === '') return '1.0';
  const depth = path.split('/').length;
  return depth <= 1 ? '0.8' : depth === 2 ? '0.7' : '0.6';
}

/* -------- collect URLs -------- */
const entries = new Map(); // url -> { lastmod, image }
const add = (url, lastmod, image) => { if (!entries.has(url)) entries.set(url, { lastmod: lastmod || today, image: image || null }); };

// Pull og:image out of a page so the sitemap carries an <image:image> entry.
function ogImage(html, pageUrl) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return null;
  try { return new URL(m[1], pageUrl).href; } catch { return null; }
}

const files = existsSync(scanDir) ? walk(scanDir) : [];
for (const f of files) {
  const rel = relPosix(f);
  if (!rel.endsWith('.html')) continue;
  if (!anyMatch(incRes, rel) || anyMatch(excRes, rel)) continue;
  const url = fileToUrl(rel);
  let img = null;
  try { img = ogImage(readFileSync(f, 'utf8'), url); } catch { /* unreadable */ }
  add(url, gitDate(f), img);
}

for (const route of cfg.extraRoutes ?? []) add(BASE + '/' + String(route).replace(/^\//, ''), today);

if (cfg.routesFrom) {
  try {
    const mod = await import(pathToFileURL(join(process.cwd(), cfg.routesFrom)).href);
    for (const r of (mod.routes ?? mod.default ?? [])) add(BASE + '/' + String(r).replace(/^\//, ''), today);
  } catch (e) { console.warn('! routesFrom failed:', e.message); }
}

if (doCrawl) await crawl(cfg.crawlUrl ?? BASE, cfg.maxCrawl ?? 200);

/* -------- optional live crawler (best-effort, same-origin) -------- */
async function crawl(startUrl, budget) {
  const origin = new URL(startUrl).origin;
  const seen = new Set(), queue = [startUrl.replace(/\/+$/, '') + '/'];
  while (queue.length && seen.size < budget) {
    const url = queue.shift();
    if (seen.has(url)) continue; seen.add(url);
    let html;
    try { const res = await fetch(url); if (!res.ok || !/text\/html/.test(res.headers.get('content-type') || '')) continue; html = await res.text(); }
    catch { continue; }
    add(url.replace(/index\.html$/, ''), today);
    for (const m of html.matchAll(/href\s*=\s*["']([^"'#?]+)/gi)) {
      let href = m[1];
      try {
        const abs = new URL(href, url);
        if (abs.origin !== origin) continue;
        if (!/\.(html?)$|\/$/.test(abs.pathname) && /\.[a-z0-9]+$/i.test(abs.pathname)) continue; // skip assets
        const norm = abs.origin + abs.pathname.replace(/index\.html$/, '');
        if (!seen.has(norm)) queue.push(norm);
      } catch { /* ignore */ }
    }
  }
}

/* -------- write sitemap.xml -------- */
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const urls = [...entries.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const hasImages = urls.some(([, e]) => e.image);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? '\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>
${urls.map(([url, { lastmod, image }]) => `  <url>
    <loc>${xmlEsc(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${defaultChangefreq}</changefreq>
    <priority>${priorityFor(url)}</priority>${image ? `
    <image:image><image:loc>${xmlEsc(image)}</image:loc></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`;
const outPath = join(scanDir, outFile);
writeFileSync(outPath, xml);
console.log(`✓ wrote ${outPath} with ${urls.length} URL(s)`);

/* -------- keep robots.txt in sync -------- */
if (updateRobots) {
  const robotsPath = join(scanDir, 'robots.txt');
  const sitemapUrl = `${BASE}/${outFile}`;
  const line = `Sitemap: ${sitemapUrl}`;
  let robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : 'User-agent: *\nAllow: /\n';
  if (!robots.includes('Sitemap:')) robots = robots.replace(/\s*$/, '\n') + '\n' + line + '\n';
  else robots = robots.replace(/Sitemap:.*$/m, line);
  writeFileSync(robotsPath, robots);
  console.log(`✓ robots.txt -> ${sitemapUrl}`);
}
