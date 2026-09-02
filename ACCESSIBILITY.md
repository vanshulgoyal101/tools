# Accessibility (a11y) — tools.vanshul.com

## Compliance Goals

**Target**: WCAG 2.1 Level AA

This document describes:
- Current accessibility features
- Known issues and remediation plan
- How to test for accessibility
- Contribution guidelines for a11y

---

## Current Accessibility Features

### Semantic HTML

| Feature | Status | Notes |
|---|---|---|
| Heading hierarchy (H1, H2, ...) | ✅ | Each page has a single H1 (tool name) |
| Form labels | ✅ | All inputs have `<label>` with `for` attribute |
| Button text | ✅ | All buttons have descriptive text (not just icons) |
| Alt text | ⚠️ | og.svg missing alt; icon emojis don't need alt |
| Landmarks | ✅ | `<header>`, `<nav>`, `<main>`, `<footer>` present |
| Link text | ✅ | Links in footer are descriptive ("Vanshul Goyal", "links.vanshul.com") |

### Keyboard Navigation

| Feature | Status | Notes |
|---|---|---|
| Tab order | ✅ | Tab cycles through inputs, buttons, links in logical order |
| Focus visible | ✅ | Focused elements have `:focus` style (outline or border) |
| Keyboard shortcuts | ✅ | Ctrl/Cmd+K opens palette; Enter submits; Esc closes |
| Tool navigation | ✅ | Arrow keys in palette; Enter to select |
| Copy button | ✅ | Accessible via Tab + Enter |
| Modal focus handling | ✅ | Palette takes focus, keeps Tab within search, and restores its trigger on Esc |

### Screen Reader Support

| Feature | Status | Notes |
|---|---|---|
| Form labels | ✅ | ARIA associations allow screen readers to announce field purpose |
| Error messages | ✅ | Tool outputs, including errors, use polite live-status regions |
| Live regions | ✅ | Copy success/failure is announced through a shared polite live region |
| Aria-labels | ⚠️ | Some buttons lack explicit aria-label (icon emoji + text is often unclear) |
| Table headers | ✅ | Query parameter table has key/value headers (implicit via layout) |
| List semantics | ⚠️ | Navigation menu uses `<a>` tags (not `<ul>`, no `role="list"`) |

### Color Contrast

| Element | Contrast Ratio | WCAG Level | Status |
|---|---|---|---|
| Text on panel (dark theme) | ~12:1 (white on #1a1a1a) | AAA | ✅ Good |
| Muted text (headings, hints) | ~4.5:1 (light gray on #1a1a1a) | AA | ✅ Acceptable |
| Accent text (links, buttons) | ~5:1 (blue on #1a1a1a) | AA | ✅ Acceptable |
| **Error text** | ~5:1 (red on #1a1a1a) | AA | ⚠️ Borderline; verify |

**Action**: Run a contrast checker (e.g., WAVE, Lighthouse, axe DevTools) to verify all color combinations.

### Focus Management

| Scenario | Status | Notes |
|---|---|---|
| Palette opens (Ctrl+K) | ✅ | Focus moves to the search input |
| Palette closes (Esc) | ✅ | Focus returns to the invoking element |
| Hash navigation | ✅ | New tool render; focus stays in main |

**Verification**: Covered by the jsdom interaction suite.

---

## Known Accessibility Issues

| Issue | Severity | Impact | Remediation |
|---|---|---|---|
| **Aria-label on icon buttons missing** | Low | "Generate" button next to hex input ambiguous | Add aria-label="Generate IDs" |
| **Query param table not marked** | Low | Screen reader may not identify as table | Use semantic `<table>` or add `role="table"` |
| **Mobile focus styles** | Low | Touch users don't see focus indicator | Add visible focus on `:focus-visible` for keyboard |

---

## Remediation Plan

### Phase 1: Quick Wins (< 1 hour)

- [ ] Add `aria-label` to icon-only buttons (e.g., "Generate IDs", "Copy output")
- [x] Announce result and error updates with polite live-status regions
- [x] Add a shared `aria-live="polite"` copy-feedback announcer
- [ ] Add CSS for `button:focus-visible` with clear outline

### Phase 2: Focus Management (1–2 hours)

- [x] Keep Tab focus in the palette search control
- [x] Restore focus to trigger element when palette closes (Esc)
- [x] Focus search input automatically when palette opens

### Phase 3: Semantic Improvements (1–2 hours)

- [ ] Convert query parameter display to semantic `<table>` (for screen readers)
- [x] Add a visible-on-focus `<a href="#main">Skip to main content</a>` link
- [ ] Review navigation menu semantics (consider `role="navigation"` or `<nav>`)

### Phase 4: Testing & Audit (2–3 hours)

- [ ] Run Lighthouse accessibility audit
- [ ] Test with screen reader (NVDA on Windows, JAWS, VoiceOver on Mac/iOS)
- [ ] Test keyboard-only navigation (no mouse)
- [ ] Verify color contrast with WCAG Color Contrast Analyzer

---

## Testing for Accessibility

### Manual Testing

#### 1. Keyboard-Only Navigation

**Procedure**:
1. Unplug mouse / disable trackpad
2. Use only Tab, Shift+Tab, Enter, Esc, Arrow keys
3. Navigate to each tool
4. Fill in an input, press Enter/click button, verify output
5. Use Ctrl/Cmd+K palette; search and select a tool

**Expected**: All functionality accessible; no stuck focus; logical tab order.

#### 2. Screen Reader (VoiceOver on Mac)

**Procedure**:
1. Enable VoiceOver: Cmd+F5 (macOS)
2. Use VO+Space to interact with elements
3. Listen for:
   - Page title and headings
   - Form field labels and descriptions
   - Button purposes
   - Error messages
   - Live region announcements

**Expected**: All interactive elements announced; purpose clear.

#### 3. Lighthouse Audit

**Procedure**:
1. Open DevTools (F12 → Lighthouse tab)
2. Generate report (select "Accessibility")
3. Review issues and recommendations

**Expected**: Score ≥90.

#### 4. axe DevTools

**Procedure**:
1. Install axe DevTools browser extension
2. Scan page
3. Review "Violations", "Best Practices", "Needs Review"

**Expected**: No critical violations; <5 warnings.

---

## Best Practices for Contributions

### Adding a New Tool

1. **Use semantic HTML**:
   ```html
   <input type="text" id="my-input" placeholder="...">
   <label for="my-input">Input label</label>
   <button type="button">Action</button>
   ```

2. **Provide error announcements**:
   ```html
   <div role="alert" class="err" id="error-msg"></div>
   <script>
     if (error) {
       document.getElementById('error-msg').textContent = 'Error description';
       // Screen reader announces immediately
     }
   </script>
   ```

3. **Add aria-labels for icon buttons**:
   ```html
   <button aria-label="Copy to clipboard">📋</button>
   ```

4. **Ensure visible focus**:
   ```css
   button:focus, input:focus {
     outline: 2px solid var(--accent);
     outline-offset: 2px;
   }
   ```

5. **Test keyboard navigation**: Tab through your tool; all inputs/buttons reachable?

6. **Test with screen reader**: Enable VoiceOver/NVDA; can you understand the tool without seeing it?

---

## Accessibility Checklist

Before submitting a PR with a new feature:

- [ ] No keyboard trap (Tab cycles smoothly; Esc closes modals)
- [ ] Visible focus indicators (`:focus` or `:focus-visible`)
- [ ] Form labels associated with inputs (`<label for="id">`)
- [ ] Buttons have descriptive text (not just icons)
- [ ] Error messages announced (`role="alert"`)
- [ ] Color contrast ≥4.5:1 for normal text, ≥3:1 for large text
- [ ] Semantic HTML (headings, landmarks, lists where appropriate)
- [ ] No reliance on color alone (e.g., error shown in red + icon + text)
- [ ] Alt text for images (if any)
- [ ] Tested with keyboard only
- [ ] Tested with screen reader (VoiceOver or NVDA)

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [Lighthouse Accessibility Audit](https://developer.chrome.com/docs/lighthouse/accessibility/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [JAWS Screen Reader](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver on Mac](https://www.apple.com/accessibility/voiceover/)

---

## WCAG 2.1 Compliance Level

**Current**: AA (with some AA+ features; some gaps)

**Roadmap**:
1. Phase 1–4 (above) → **Level AA**
2. Further refinements → **Level AAA** (optional; not required)

**Non-targets** (out of scope):
- Timed auto-refreshes (not present)
- PDF accessibility (no PDFs shipped)
- Video captions (no video)
- Audio descriptions (no audio/video)
