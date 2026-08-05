# tools.vanshul.com

A **privacy-first, offline developer toolbox**. A single self-contained page with
a dozen everyday utilities that run **100% in your browser** — nothing is ever
uploaded, and everything works offline (installable as a PWA).

## Tools included

| Tool | What it does |
| --- | --- |
| JSON formatter | Pretty-print, minify & validate JSON |
| Base64 | Encode / decode (UTF-8 safe) |
| URL encode | Encode / decode URL components |
| JWT decoder | Inspect header, payload & claims (no signature check) |
| Hash | SHA-1 / SHA-256 / SHA-512 via WebCrypto |
| UUID | Generate random v4 UUIDs |
| Timestamp | Convert between Unix time and dates |
| Color | HEX ⇄ RGB ⇄ HSL with a picker |
| Text | Word/char counts + case conversion |
| Line diff | Compare two text blocks (LCS) |

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
cd ideas/tools && python3 -m http.server 8081
# open http://localhost:8081  (http, not file://, so the service worker registers)
```

## Deploy

1. Push this folder to a public repo (e.g. `vanshul-tools`) at the root.
2. Add `.nojekyll` next to `CNAME`.
3. Enable GitHub Pages (`main` / root).
4. DNS: `CNAME` record `tools → vanshulgoyal101.github.io`.
5. Enforce HTTPS once the cert is issued.

## Next tools to add

QR generator, cron (link to `cron.vanshul.com`), Markdown preview, regex tester,
number-base converter, image → data-URI, YAML ⇄ JSON.
