# CodeGuard — Implementation Plan

## Top-Level Overview

**Goal:** Build a fully client-side web application that lets users paste source code, pick a language, and receive instant rule-based static analysis results — errors, warnings, and suggestions — all without any backend, API key, or build tool.

**Scope:** Five files delivered and working by opening `index.html` in any modern browser.

**Approach:** JavaScript loads `rules.json` at startup (via `fetch`). When the user clicks *Analyze*, the engine iterates every rule for the selected language, tests each regex pattern against the pasted code, and populates the results panel. Recent analyses are persisted to `localStorage`.

---

## File Map

| File | Purpose |
|------|---------|
| `index.html` | App shell — layout, semantic markup, modal for examples |
| `style.css` | Design tokens, responsive grid, result-card styles |
| `script.js` | Rule loader, analysis engine, DOM controller, localStorage |
| `rules.json` | All language rules as structured JSON data |
| `README.md` | Setup, usage, and feature walkthrough |

---

## Architecture: How the Pieces Connect

```
rules.json
    │  (fetch on page load)
    ▼
script.js  ──► analyzeCode(language, source)
    │               │
    │       iterate rules for language
    │       regex.test(line) → match → push finding
    │               │
    ▼               ▼
index.html      results panel (errors / warnings / suggestions)
                summary badge (total issue count)
                localStorage.setItem(snapshot)
```

---

## Sub-Tasks

---

### Sub-Task 1 — Create `rules.json`

**Intent:** Define every static-analysis rule as structured data so rules stay separate from code logic and can be extended without touching JavaScript.

**Expected Outcomes:**
- A valid JSON file containing a top-level object with keys `"python"`, `"cpp"`, and `"javascript"`.
- Each language maps to an array of rule objects.
- Each rule object has: `id`, `severity` (`"error"` | `"warning"` | `"suggestion"`), `message`, `pattern` (regex string), and `description`.
- At minimum 6–8 rules per language covering: bare `except`/`catch`, `eval()`, unused variable patterns, missing semicolons, `var` usage, `==` vs `===`, buffer-overflow-prone patterns, `goto`, `printf` without format strings, `gets()`.

**Todo List:**
1. Create `rules.json` with Python rules (bare except, eval, mutable default arg, wildcard import, `==` None instead of `is`, `print` without parens as warning).
2. Add JavaScript rules (var declaration, ==, eval, console.log left in, missing semicolons after return, TODO/FIXME comment flags).
3. Add C++ rules (gets() usage, printf without literal format string, raw pointer new without delete nearby, goto statement, system() call, magic numbers).
4. Validate the JSON is well-formed.

**Status:** `[ ] pending`

---

### Sub-Task 2 — Create `index.html`

**Intent:** Provide the structural skeleton of the app — code editor textarea, language selector, action buttons, and results panel — all accessible and semantic.

**Expected Outcomes:**
- A single HTML file that opens without errors in Chrome/Firefox/Edge.
- Contains: header with app name + tagline, language `<select>`, code `<textarea>`, *Analyze*, *Load Example*, and *Clear* buttons, and a results section with three sub-panels (Errors, Warnings, Suggestions) plus a summary bar.
- Links `style.css` and `script.js` (deferred).
- A disclaimer banner stating "Rule-based static analysis — not AI".

**Todo List:**
1. Write the `<head>` with meta charset/viewport, title, and CSS link.
2. Write the `<header>` with logo text, subtitle, and disclaimer badge.
3. Write the main two-column layout: left = editor pane, right = results pane.
4. Editor pane: language selector, textarea with placeholder, button row.
5. Results pane: summary bar (issue count), three collapsible/scrollable cards for Errors / Warnings / Suggestions.
6. Add a "Recent Analyses" sidebar strip at the bottom of the results pane.
7. Add the `<script defer>` tag at the bottom of `<body>`.

**Status:** `[ ] pending`

---

### Sub-Task 3 — Create `style.css`

**Intent:** Give the app a polished developer-tool look using a dark theme, clear typography, and responsive layout — no external CSS frameworks.

**Expected Outcomes:**
- CSS custom properties (variables) for all colours and spacing.
- Dark background (#0f1117 family) with accent colour for interactive elements.
- Two-column grid on desktop that stacks to one column on mobile (≤768 px).
- Textarea styled like a code editor (monospace font, line-height, subtle border).
- Severity-coded result cards: red for errors, amber for warnings, blue for suggestions.
- Button hover/active states. Smooth transitions.

**Todo List:**
1. Define `:root` design tokens (colours, font sizes, radius, spacing).
2. Style global reset, body, and header.
3. Style the main grid layout (editor + results side by side).
4. Style the language selector and textarea.
5. Style the three buttons (Analyze = primary, Load Example = secondary, Clear = ghost).
6. Style result cards with left-border severity colours and icon characters.
7. Style the summary bar and issue count badge.
8. Style the recent-analyses list.
9. Add responsive breakpoint.

**Status:** `[ ] pending`

---

### Sub-Task 4 — Create `script.js`

**Intent:** Implement the complete client-side logic: rule loader, analysis engine, DOM renderer, example code library, and localStorage history.

**Expected Outcomes:**
- On `DOMContentLoaded`, `fetch('./rules.json')` loads rules; any fetch error shows a UI-level warning (not a silent console error).
- `analyzeCode(language, source)` iterates line-by-line, tests each rule's regex, and returns `{ errors[], warnings[], suggestions[], totalLines }`.
- `renderResults(findings)` clears previous results and populates the three cards; shows "No issues found" placeholder per empty card.
- Summary bar always shows total issue count with correct singular/plural.
- "Load Example" populates the textarea with a pre-authored buggy snippet for the selected language.
- "Clear" wipes textarea and results panel.
- After each successful analysis, a snapshot `{ language, timestamp, counts }` is saved to `localStorage` and the recent-analyses list is re-rendered (capped at 5 entries).

**Todo List:**
1. Bootstrap: `fetch` rules, handle error, store in module-scoped variable.
2. Implement `analyzeCode(language, source)` — line iteration + regex matching.
3. Implement `renderResults(findings)` — clear + populate three panels + summary.
4. Wire *Analyze* button: validate non-empty input, call engine, render, save history.
5. Wire *Load Example* button with per-language buggy snippets defined inline.
6. Wire *Clear* button.
7. Implement `saveHistory(snapshot)` and `renderHistory()` using `localStorage`.
8. Add empty-input guard with an inline validation message.

**Status:** `[ ] pending`

---

### Sub-Task 5 — Create `README.md`

**Intent:** Provide clear, student-friendly instructions so anyone can run the project in under two minutes.

**Expected Outcomes:**
- Sections: Project Overview, Features, How to Run, File Structure, How Analysis Works, Example Languages, Limitations.
- "How to Run" requires only: clone/download → open `index.html` in browser. No npm, no pip, no server needed (except a note about `fetch` and `file://` protocol requiring a simple live-server or VS Code extension if rules.json doesn't load locally).

**Todo List:**
1. Write project overview and feature list.
2. Write setup/run instructions with the live-server workaround note.
3. Document file structure with one-line descriptions.
4. Explain how rules work and how to add new ones.
5. List known limitations (rule-based, not AI; no cross-file analysis).

**Status:** `[ ] pending`

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Rule storage | `rules.json` loaded via `fetch` | Keeps rules editable without touching JS |
| Analysis granularity | Line-by-line regex | Simple, transparent, beginner-readable |
| No bundler | Plain `<script defer>` | Open `index.html` directly — zero setup |
| `fetch` on `file://` | README notes VS Code Live Server | Avoids CORS error without forcing Node |
| AI disclaimer | Prominent badge in header | Honesty about what rule-based means |
| History cap | 5 entries in localStorage | Keeps UI clean; no overflow risk |
