# CodeGuard — Code Analysis & Bug Detection Tool

A beginner-friendly, fully client-side web application that analyses source code for common bugs, security risks, and bad practices using **rule-based static analysis**. No AI, no backend, no API keys required.

---

## Features

| Feature | Details |
|---------|---------|
| Language support | Python, JavaScript, C++ |
| Issue categories | Errors, Warnings, Suggestions |
| Example snippets | Pre-loaded buggy code per language for instant demo |
| Results summary | Total issue count with per-severity chips |
| Collapsible cards | Each severity group can be expanded/collapsed |
| Analysis history | Last 5 analyses saved in browser localStorage |
| Responsive design | Works on desktop and mobile |
| Zero dependencies | Plain HTML + CSS + JavaScript — no npm, no pip |

---

## How to Run

### Option A — VS Code Live Server (Recommended, zero setup)

1. Install the **Live Server** extension in VS Code  
   (`Ext ID: ritwickdey.liveserver`)
2. Open the `CodeGuard` project folder in VS Code.
3. Right-click `index.html` → **"Open with Live Server"**.
4. Your browser opens at `http://127.0.0.1:5500` — the app is ready.

### Option B — Python's built-in server

```bash
# From the CodeGuard folder:
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Option C — Node.js serve (if you have Node installed)

```bash
npx serve .
```

Then open the URL printed in the terminal.

### ⚠ Why can't I just double-click index.html?

Modern browsers block `fetch()` requests when a page is opened from the local file system (`file://` protocol) due to CORS security restrictions. `rules.json` is loaded with `fetch`, so a local server is needed. Any of the three options above works — all are one command.

---

## Project Structure

```
CodeGuard/
├── index.html      # App shell — layout, panels, buttons
├── style.css       # Dark developer theme, responsive grid
├── script.js       # Analysis engine, DOM logic, localStorage
├── rules.json      # All analysis rules as JSON data
└── README.md       # This file
```

---

## How Analysis Works

1. When the page loads, `script.js` fetches `rules.json` and caches all rules in memory.
2. When you click **Analyse Code**, the engine splits your code into lines.
3. Each line is tested against every rule for the selected language using a **regular expression**.
4. Matching lines produce a *finding* with a severity level, message, and explanation.
5. Findings are grouped into **Errors**, **Warnings**, and **Suggestions** and displayed in the results panel.

This is **static analysis** — the code is never executed. It works by recognising known dangerous or poor-quality patterns.

---

## Analysis Rules Reference

Rules live in `rules.json`. Each rule has this shape:

```json
{
  "id":          "PY001",
  "severity":    "error",
  "pattern":     "^\\s*except\\s*:",
  "message":     "Bare 'except' clause catches all exceptions including system exits.",
  "description": "Use 'except Exception as e:' …"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique rule identifier (e.g. `PY001`, `JS003`, `CPP007`) |
| `severity` | `"error"` / `"warning"` / `"suggestion"` |
| `pattern` | JavaScript-compatible regex string tested against each line |
| `message` | Short, actionable issue title shown in the UI |
| `description` | Longer explanation with a fix suggestion |

### Rules per language

**Python (10 rules):** bare `except`, `eval()`, `exec()`, wildcard import, `== None`, mutable default list/dict argument, TODO comments, `print()` debug calls, bare `pass`.

**JavaScript (10 rules):** `eval()`, `document.write()`, `innerHTML =`, `var` declaration, loose `==`, `console.log/warn/error`, `setTimeout` with string, TODO comments, null loose comparison.

**C++ (10 rules):** `gets()`, `system()`, `strcpy()`, `sprintf()`, `goto`, `printf` with variable format string, raw `new`, `malloc()`, TODO comments, `using namespace std`.

---

## Adding Your Own Rules

Open `rules.json` and add a new object to the relevant language array:

```json
{
  "id": "JS011",
  "severity": "warning",
  "pattern": "\\balert\\s*\\(",
  "message": "alert() found — remove before production.",
  "description": "Browser alert() blocks the UI thread and is unsuitable for production applications."
}
```

Save the file and refresh the page — the new rule is applied automatically.

---

## Limitations

- **Rule-based, not AI.** Only patterns explicitly defined in `rules.json` are detected. A rule cannot reason about control flow, data types, or multi-line context.
- **Line-by-line only.** Each line is checked independently. Cross-line or cross-function issues are not detected.
- **No false-positive filtering.** A pattern match on a comment line still produces a finding.
- **Not a replacement for a linter.** For serious projects, use ESLint (JavaScript), Pylint/flake8 (Python), or Clang-Tidy (C++) alongside CodeGuard.

---

## Demo Walkthrough

1. Open the app in your browser.
2. Select a language (e.g. Python).
3. Click **Load Example** — a pre-written buggy snippet appears.
4. Click **Analyse Code**.
5. Review the Errors, Warnings, and Suggestions panels.
6. Try the other two languages.
7. Paste your own code and click **Analyse Code**.

---

## Tech Stack

| Technology | Role |
|------------|------|
| HTML5 | Semantic structure |
| CSS3 (custom properties + grid) | Styling and responsive layout |
| Vanilla JavaScript (ES6+) | Analysis engine and DOM control |
| JSON | Rule data storage |
| Browser localStorage | Analysis history (no database) |

---

*Built as a second-year BTech student project. Rule-based static analysis — not AI-powered.*
