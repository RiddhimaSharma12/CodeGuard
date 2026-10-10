/**
 * CodeGuard — Rule-Based Static Code Analysis
 * Runs entirely in the browser. No backend, no AI, no API keys.
 *
 * Flow:
 *  1. On load  → fetch rules.json and cache rules.
 *  2. Analyse  → iterate lines × rules (regex match) → collect findings.
 *  3. Render   → populate results panel + summary bar.
 *  4. History  → persist last 5 snapshots to localStorage.
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const RULES_URL        = './rules.json';
const LS_KEY           = 'codeguard_history';
const MAX_HISTORY      = 5;

// Emoji labels per language for history entries
const LANG_LABEL = {
  python:     '🐍 Python',
  javascript: '🟨 JavaScript',
  cpp:        '⚙ C++'
};

// ── Example Snippets (one buggy snippet per language) ──────────────────────

const EXAMPLES = {
  python: `# Python example — intentionally contains common mistakes

import os
from sys import *          # wildcard import warning

def process_data(items=[]):   # mutable default argument
    try:
        result = eval(input("Enter expression: "))  # eval() danger
        for item in items:
            print(item)     # debug print
        return result
    except:                 # bare except
        pass                # empty except block

if __name__ == "__main__":
    data = None
    if data == None:        # should use 'is None'
        process_data()
# TODO: add error handling here
`,

  javascript: `// JavaScript example — intentionally contains common mistakes

var userName = "Alice";    // var instead of const/let
var userAge  = 25;

function greetUser(name) {
  if (name == "Admin") {   // loose equality
    document.write("<h1>Welcome Admin</h1>");  // document.write
  }
  var greeting = "Hello, " + name;
  console.log(greeting);   // debug console.log
  return greeting;
}

function runUserCode(code) {
  eval(code);              // eval danger
}

// TODO: validate user input before processing

var result = greetUser(userName);
document.getElementById("output").innerHTML = result;  // innerHTML XSS risk
setTimeout("greetUser('Bob')", 1000);                   // string setTimeout
`,

  cpp: `// C++ example — intentionally contains common mistakes

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

using namespace std;  // namespace pollution

int main() {
    char buffer[64];
    char name[32];

    printf("Enter command: ");
    gets(buffer);           // gets() — buffer overflow

    char* dest = (char*)malloc(64);   // malloc in C++
    strcpy(dest, buffer);   // strcpy — no bounds check

    printf(buffer);         // format string injection

    system("ls -la");       // system() call — dangerous

    int* ptr = new int(42); // raw new — needs delete
    goto cleanup;           // goto statement

    sprintf(buffer, buffer); // sprintf — no size limit

// TODO: free memory properly
cleanup:
    return 0;
}
`
};

// ── Module State ───────────────────────────────────────────────────────────

let rulesDB = null;   // loaded from rules.json: { python: [...], javascript: [...], cpp: [...] }

// ── DOM References ─────────────────────────────────────────────────────────

const languageSelect  = document.getElementById('language-select');
const codeInput       = document.getElementById('code-input');
const inputError      = document.getElementById('input-error');
const btnAnalyze      = document.getElementById('btn-analyze');
const btnExample      = document.getElementById('btn-example');
const btnClear        = document.getElementById('btn-clear');
const summaryBar      = document.getElementById('summary-bar');
const resultsCards    = document.getElementById('results-cards');
const historyList     = document.getElementById('history-list');
const btnClearHistory = document.getElementById('btn-clear-history');

// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadRules();
  renderHistory();
  wireEvents();
});

/**
 * Fetch rules.json and store in rulesDB.
 * Shows a UI-level error banner if the fetch fails (e.g. file:// CORS).
 */
function loadRules() {
  fetch(RULES_URL)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      rulesDB = data;
    })
    .catch(err => {
      showRulesLoadError(err);
    });
}

function showRulesLoadError(err) {
  const banner = document.createElement('div');
  banner.style.cssText = [
    'background:#1a0c0c',
    'color:#f85149',
    'border-bottom:1px solid #6e1a18',
    'padding:0.6rem 1.1rem',
    'font-size:0.82rem'
  ].join(';');
  banner.innerHTML = `
    ⚠ <strong>Could not load rules.json</strong> (${err.message}).
    If you opened this file directly from your file system, rules cannot be fetched due to
    browser security restrictions. Open the project with a local server instead
    (e.g. VS Code <em>Live Server</em> extension, or run <code>python -m http.server</code>
    in the project folder then visit <a href="http://localhost:8000" style="color:#58a6ff">localhost:8000</a>).
  `;
  document.body.insertBefore(banner, document.querySelector('main'));
  btnAnalyze.disabled = true;
}

// ── Event Wiring ───────────────────────────────────────────────────────────

function wireEvents() {
  btnAnalyze.addEventListener('click', handleAnalyze);
  btnExample.addEventListener('click', handleLoadExample);
  btnClear.addEventListener('click', handleClear);
  btnClearHistory.addEventListener('click', handleClearHistory);
  codeInput.addEventListener('input', () => hideInputError());
}

// ── Handlers ───────────────────────────────────────────────────────────────

function handleAnalyze() {
  const source   = codeInput.value;
  const language = languageSelect.value;

  if (!source.trim()) {
    showInputError();
    return;
  }
  hideInputError();

  if (!rulesDB) {
    alert('Rules are still loading. Please wait a moment and try again.');
    return;
  }

  const findings = analyzeCode(language, source);
  renderResults(findings, language, source);
  saveHistory({ language, findings, timestamp: Date.now() });
  renderHistory();
}

function handleLoadExample() {
  const language = languageSelect.value;
  codeInput.value = EXAMPLES[language] || '';
  hideInputError();
  // Auto-scroll textarea to top
  codeInput.scrollTop = 0;
}

function handleClear() {
  codeInput.value = '';
  hideInputError();
  resetResultsPanel();
  resetSummaryBar();
}

function handleClearHistory() {
  localStorage.removeItem(LS_KEY);
  renderHistory();
}

// ── Input Validation Helpers ───────────────────────────────────────────────

function showInputError() {
  inputError.hidden = false;
  codeInput.style.borderBottom = '2px solid var(--error)';
}

function hideInputError() {
  inputError.hidden = true;
  codeInput.style.borderBottom = '';
}

// ── Analysis Engine ────────────────────────────────────────────────────────

/**
 * Analyse source code for the given language using rules from rulesDB.
 *
 * @param {string} language  - 'python' | 'javascript' | 'cpp'
 * @param {string} source    - raw source code string
 * @returns {{ errors: Finding[], warnings: Finding[], suggestions: Finding[], totalLines: number }}
 *
 * Finding shape: { ruleId, severity, message, description, line, lineContent }
 */
function analyzeCode(language, source) {
  const errors      = [];
  const warnings    = [];
  const suggestions = [];

  const languageRules = rulesDB[language];
  if (!languageRules || languageRules.length === 0) {
    return { errors, warnings, suggestions, totalLines: 0 };
  }

  const lines = source.split('\n');

  lines.forEach((lineContent, index) => {
    const lineNumber = index + 1;

    languageRules.forEach(rule => {
      let regex;
      try {
        regex = new RegExp(rule.pattern, 'i');
      } catch (e) {
        console.warn(`CodeGuard: invalid regex in rule ${rule.id}: ${e.message}`);
        return;
      }

      if (regex.test(lineContent)) {
        const finding = {
          ruleId:      rule.id,
          severity:    rule.severity,
          message:     rule.message,
          description: rule.description,
          line:        lineNumber,
          lineContent: lineContent.trim()
        };

        if (rule.severity === 'error')           errors.push(finding);
        else if (rule.severity === 'warning')    warnings.push(finding);
        else if (rule.severity === 'suggestion') suggestions.push(finding);
      }
    });
  });

  return { errors, warnings, suggestions, totalLines: lines.length };
}

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * Render analysis findings into the results panel.
 */
function renderResults({ errors, warnings, suggestions, totalLines }, language, source) {
  const total = errors.length + warnings.length + suggestions.length;

  // Summary bar
  renderSummaryBar(errors.length, warnings.length, suggestions.length, totalLines);

  // Results cards
  resultsCards.innerHTML = '';

  if (total === 0) {
    resultsCards.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No issues found in your ${LANG_LABEL[language] || language} code.</p>
        <p class="empty-sub">Analysed ${totalLines} line${totalLines !== 1 ? 's' : ''}. All ${rulesDB[language].length} rules passed.</p>
      </div>`;
    return;
  }

  resultsCards.appendChild(buildSeverityGroup('error',      '⛔ Errors',       errors));
  resultsCards.appendChild(buildSeverityGroup('warning',    '⚠ Warnings',     warnings));
  resultsCards.appendChild(buildSeverityGroup('suggestion', '💡 Suggestions',  suggestions));
}

/**
 * Build one collapsible severity group card.
 */
function buildSeverityGroup(severity, label, findings) {
  const group = document.createElement('div');
  group.className = `severity-group ${severity}`;
  if (findings.length === 0) group.classList.add('collapsed');

  const header = document.createElement('div');
  header.className = 'severity-group-header';
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', String(findings.length > 0));
  header.innerHTML = `
    <span class="sgh-left">
      <span>${label}</span>
      <span class="sgh-count">${findings.length}</span>
    </span>
    <span class="sgh-toggle">▾</span>`;

  header.addEventListener('click', () => {
    group.classList.toggle('collapsed');
    header.setAttribute('aria-expanded', String(!group.classList.contains('collapsed')));
  });

  const body = document.createElement('div');
  body.className = 'severity-group-body';

  if (findings.length === 0) {
    body.innerHTML = `<div class="no-issues-msg">No ${label.replace(/[^a-z ]/gi,'').trim().toLowerCase()} found.</div>`;
  } else {
    findings.forEach(f => {
      body.appendChild(buildFindingItem(f));
    });
  }

  group.appendChild(header);
  group.appendChild(body);
  return group;
}

/**
 * Build a single finding row.
 */
function buildFindingItem(finding) {
  const item = document.createElement('div');
  item.className = 'finding-item';

  // Escape HTML for safe display of line content
  const safeLineContent = escapeHtml(finding.lineContent);

  item.innerHTML = `
    <span class="finding-line">L${finding.line}</span>
    <span class="finding-rule-id">${escapeHtml(finding.ruleId)}</span>
    <span class="finding-message">${escapeHtml(finding.message)}</span>
    <span class="finding-description">
      ${escapeHtml(finding.description)}
      <br><code style="font-size:0.72rem;color:var(--text-muted)">${safeLineContent}</code>
    </span>`;

  return item;
}

/**
 * Render the summary bar with counts.
 */
function renderSummaryBar(errorCount, warningCount, suggestionCount, totalLines) {
  const total = errorCount + warningCount + suggestionCount;

  if (total === 0) {
    summaryBar.innerHTML = `
      <div class="summary-stats">
        <span class="summary-total">✅ No issues detected</span>
        <div class="summary-chips">
          <span class="chip chip-clean">Clean Code</span>
        </div>
        <span class="summary-meta">${totalLines} line${totalLines !== 1 ? 's' : ''} analysed</span>
      </div>`;
    return;
  }

  summaryBar.innerHTML = `
    <div class="summary-stats">
      <span class="summary-total">${total} issue${total !== 1 ? 's' : ''} found</span>
      <div class="summary-chips">
        ${errorCount      > 0 ? `<span class="chip chip-error">⛔ ${errorCount} Error${errorCount !== 1 ? 's' : ''}</span>` : ''}
        ${warningCount    > 0 ? `<span class="chip chip-warning">⚠ ${warningCount} Warning${warningCount !== 1 ? 's' : ''}</span>` : ''}
        ${suggestionCount > 0 ? `<span class="chip chip-suggestion">💡 ${suggestionCount} Suggestion${suggestionCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <span class="summary-meta">${totalLines} line${totalLines !== 1 ? 's' : ''} analysed</span>
    </div>`;
}

function resetResultsPanel() {
  resultsCards.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>No analysis run yet.</p>
      <p class="empty-sub">Paste code and click <strong>Analyse Code</strong>.</p>
    </div>`;
}

function resetSummaryBar() {
  summaryBar.innerHTML = `
    <div class="summary-idle">
      <span class="summary-hint">Run an analysis to see results here.</span>
    </div>`;
}

// ── localStorage History ───────────────────────────────────────────────────

/**
 * Save a compact snapshot of the latest analysis to localStorage.
 * Keeps only the most recent MAX_HISTORY entries.
 */
function saveHistory({ language, findings, timestamp }) {
  let history = readHistory();

  history.unshift({
    language,
    timestamp,
    errorCount:      findings.errors.length,
    warningCount:    findings.warnings.length,
    suggestionCount: findings.suggestions.length
  });

  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(history));
  } catch (e) {
    // localStorage may be unavailable (private browsing, quota exceeded)
    console.warn('CodeGuard: could not save history to localStorage:', e.message);
  }
}

function readHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Render the history list from localStorage.
 */
function renderHistory() {
  const history = readHistory();
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<li class="history-empty">No history yet.</li>';
    btnClearHistory.hidden = true;
    return;
  }

  btnClearHistory.hidden = false;

  history.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const total = entry.errorCount + entry.warningCount + entry.suggestionCount;
    const countsText = total === 0
      ? 'No issues'
      : [
          entry.errorCount      > 0 ? `${entry.errorCount}E`      : null,
          entry.warningCount    > 0 ? `${entry.warningCount}W`    : null,
          entry.suggestionCount > 0 ? `${entry.suggestionCount}S` : null
        ].filter(Boolean).join(', ');

    li.innerHTML = `
      <span class="history-lang">${LANG_LABEL[entry.language] || entry.language}</span>
      <span class="history-counts">${countsText}</span>
      <span class="history-time">${formatRelativeTime(entry.timestamp)}</span>`;

    historyList.appendChild(li);
  });
}

// ── Utility Helpers ────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS when inserting user content.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Return a human-readable relative time string (e.g. "2 min ago").
 */
function formatRelativeTime(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(timestamp).toLocaleDateString();
}
