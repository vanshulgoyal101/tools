# tools.vanshul.com

A **privacy-first, offline developer toolbox**. A single self-contained page with
a dozen everyday utilities that run **100% in your browser** — nothing is ever
uploaded, and everything works offline (installable as a PWA).

## The wedge: Smart Paste + ⌘K palette

What makes this more than "just another toolbox": you don't pick a tool first.

- **Smart Paste** — the home screen is one box. Paste *anything* and it
  auto-detects the type and decodes/converts it inline: JWT, JSON, Base64,
  URL-encoded text, hex colours, Unix timestamps, UUIDs, hash digests (by
  length) and integers (radix). Each result links through to the full tool.
- **Command palette** — press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> to fuzzy-search
  and jump to any tool, keyboard-only.

Everything else is still a click away in the tool grid below.

## Tools included

| Tool | What it does |
| --- | --- |
| JSON formatter | Pretty-print, minify & validate JSON |
| Base64 | Encode / decode (UTF-8 safe) |
| URL encode | Encode / decode URL components |
| JWT decoder | Inspect header, payload & claims (no signature check) |
| Hash | SHA-1 / SHA-256 / SHA-512 via WebCrypto |
| ID & random | UUID v4, ULID, nanoid, random hex & passwords |
| Timestamp | Convert between Unix time and dates |
| Color | HEX ⇄ RGB ⇄ HSL with a picker |
| Text | Word/char counts + case conversion |
| Line diff | Compare two text blocks (LCS) |
| Regex tester | Live match highlighting, capture groups & replace preview |
| Token & cost | Approx LLM token count + input-cost estimate |
| Cron | Explain a cron expression & preview next runs |
| JSON ⇄ YAML | Convert between JSON and YAML (common subset) |
| JSON tools | JSON → TypeScript types, sort keys & path query |
| cURL → code | Turn a `curl` command into `fetch` / Python `requests` |
| Transform | Sort/dedupe lines, slugify, case styles, CSV ⇄ JSON |
| HMAC & CRC | Keyed HMAC-SHA and CRC32 checksums |
| QR code | Generate a scannable QR (byte mode, ECC level M, offline) |

Each tool is a route (`#json`, `#base64`, …) so any tool is directly linkable.

## Privacy

Every conversion happens locally with plain JavaScript / `crypto.subtle`. There
are no network calls for any tool and no analytics that read your input. The
service worker only caches the static shell.

## Files

```
tools/
├── index.html            # entire app (markup + CSS + JS)
├── manifest.webmanifest  # PWA install metadata
├── sw.js                 # offline service worker
├── CNAME                 # tools.vanshul.com
└── README.md
```

## Run locally

```sh
cd tools && python3 -m http.server 8081
# open http://localhost:8081  (http, not file://, so the service worker registers)
```

## Deploy

1. Push this folder to a public repo (e.g. `vanshul-tools`) at the root.
2. Add `.nojekyll` next to `CNAME`.
3. Enable GitHub Pages (`main` / root).
4. DNS: `CNAME` record `tools → vanshulgoyal101.github.io`.
5. Enforce HTTPS once the cert is issued.

## Next tools to add

Markdown preview, number-base converter, image → data-URI, QR reader
(via `BarcodeDetector`). A cron builder also lives at `cron.vanshul.com`.
