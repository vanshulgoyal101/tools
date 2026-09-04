# Features — tools.vanshul.com

> **TL;DR** — Capability catalog for the offline developer toolbox: ✅ shipped, 🔜
> proposed, ⛔ non-goal. 27 utilities + Smart Paste + ⌘K palette, running 100% in
> the browser (installable PWA). Zero runtime dependencies.

**Legend:** ✅ shipped · 🔜 proposed/potential · ⛔ deliberate non-goal.

## The wedge (✅)

- ✅ **Smart Paste** — one box on the home screen; paste anything and it
  auto-detects + decodes/converts inline (JWT, JSON, Base64, URL-encoded, hex
  colours, Unix timestamps, UUIDs, hash digests by length, integers by radix),
  each linking through to the full tool.
- ✅ **Command palette** — <kbd>⌘K</kbd>/<kbd>Ctrl K</kbd> fuzzy-search + jump to
  any tool, keyboard-only.

## Tools (✅)

JSON formatter · Base64 · URL encode · JWT decoder · Hash (SHA-1/256/512) · ID &
random (UUID/ULID/nanoid/hex/password) · Timestamp · Color (HEX⇄RGB⇄HSL) · Text
(counts + case) · Line diff (LCS) · Regex tester · Token & cost estimate · Cron
explainer · JSON⇄YAML · JSON tools (→TS types, sort keys, path query) · cURL→code
· Transform (sort/dedupe/slugify/case/CSV⇄JSON) · HMAC & CRC32 · QR code. Each is
a hash route (`#json`, `#base64`, …) so any tool is directly linkable.

## Platform (✅)

- ✅ **Privacy-first** — every conversion runs locally (`crypto.subtle` / plain
  JS); **no network calls**, no analytics that read your input.
- ✅ **Offline PWA** — installable; service worker caches the static shell.
- ✅ **Zero runtime dependencies** — ships as 3 static files (`index.html` UI +
  `lib.js` pure logic + `sw.js`); **the code that ships is the code that's tested**.
- ✅ **Tested** — pure logic in `lib.js` unit-tested (Vitest); SEO + share card.

## Proposed / potential 🔜

- More utilities (e.g. diff-as-patch, more encoders); per-tool deep-linkable state.

## Non-goals ⛔

- **Any backend / server upload** — everything is client-side, by design.
- **Analytics that read user input** — privacy is the product.
