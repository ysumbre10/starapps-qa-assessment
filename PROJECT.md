# QA Skill Check — Project Documentation

## Overview

A browser-based QA assessment engine for evaluating candidates with 1–3 years of QA experience. Candidates work through 9 timed domains covering Manual Testing, API Testing, Back-End Testing, DB Log Reading, Test Automation, Root Cause Analysis, Complex Systems, AI in QA, and a live QA Playground.

No frameworks, no build step. Pure HTML + CSS + Vanilla JS IIFE. Runs from any static host or `file://`.

---

## File Structure

```
/
├── index.html          Registration form (name, email, experience, role)
├── instructions.html   Rules page, begins assessment on click
├── assessment.html     Assessment shell (timer, progress bar, card)
├── thankyou.html       Results and score breakdown
├── demo-app.html       ShopLab buggy demo app (QA Playground right panel)
├── assessment.js       Engine + all questions + split-screen logic
├── style.css           Design system + split-screen CSS
├── config.js           Google Sheets + AI eval endpoints (gitignored)
├── logo.png            Starapps Studio logo
└── PROJECT.md          This file
```

---

## Architecture

### Engine (assessment.js)
- **IIFE** — zero globals. Console cannot touch timer, answers, or state.
- **Wall-clock deadline timer** — `_deadline` is an absolute timestamp. `Date.now` spoofing from DevTools has no effect because `_now` is captured at IIFE init.
- **Watchdog** — recursive `setTimeout` (not `setInterval`), ID changes every 3s, brute-force `clearInterval(1..9999)` cannot kill it.
- **XOR-encoded answer key** — correct answers never stored in plain text. `_K[di][mi] = answer_index XOR ((di*31 + mi*17 + 0xF3) & 0xFF)`.
- **FNV-1a signature** — `sessionStorage` is signed after each domain. Any direct edit between domains is detected and flagged in the submission.
- **Domain lock** — completed domains cannot be re-entered. Full submission cannot be retaken even if `qa_current_task` is reset to 0 in DevTools (signed `qa_submitted` flag checked).
- **Back-button timer fix** — deadline persisted to `sessionStorage.qa_domain_deadline`. On page load: if deadline is in the future, resume; if it passed while away, auto-submit immediately.
- **Tab-switch tracking** — `visibilitychange` counts tab switches, flagged in submission.

### Data flow
```
index.html  →  sessionStorage(qa_candidate)
instructions.html  →  sessionStorage(qa_current_task = 0)
assessment.html/js  →  sessionStorage(qa_responses, qa_timings, qa_sig)
[last domain submit]  →  Google Sheets (flat row) + Cloudflare Worker (AI eval)
thankyou.html  →  reads sessionStorage, renders score breakdown
```

---

## Domains

| # | Domain | MCQs | Open Tasks | Max Marks |
|---|--------|------|------------|-----------|
| 1 | Manual Testing | 7 | 0 | 14 |
| 2 | API Testing | 5 | 2 | 30 |
| 3 | Back-End Testing | 5 | 2 | 30 |
| 4 | DB Log Reading | 5 | 2 | 30 |
| 5 | Test Automation | 5 | 2 | 30 |
| 6 | Root Cause Analysis | 5 | 2 | 30 |
| 7 | Complex Systems | 5 | 2 | 30 |
| 8 | AI in QA | 5 | 2 | 30 |
| 9 | QA Playground | 8 | 2 | 36 |
| **Total** | | | | **260** |

**Marks:** MCQ = 2 marks per correct answer. Open tasks = 0–10 per task, reviewed by team.

---

## QA Playground (Domain 9) — ShopLab

Domain 9 renders in split-screen: left panel = questions, right panel = `demo-app.html` in an iframe.

### ShopLab Bugs

#### 5 Normal Bugs (any QA should catch)

| ID | Bug | Location | Type |
|----|-----|----------|------|
| N1 | Quantity counter goes negative — no minimum check on decrement | Products page, qty control | Functional |
| N2 | Email field accepts invalid format (e.g. "qatester" with no @) — `type="text"` not `type="email"` | Contact form | Validation |
| N3 | "Add to Cart" works on Out of Stock items — no stock check in `addToCart()` | Products page | Functional |
| N4 | USB-C Hub image is broken (src points to non-existent file), no `alt` attribute | Products page | UI / Accessibility |
| N5 | Contact form submits with empty Name + Email fields — no required-field validation | Contact form | Validation |

#### 5 Hard Bugs (only sharp QAs catch)

| ID | Bug | Location | Type |
|----|-----|----------|------|
| H1 | "Price: Low to High" uses string sort — `"129.99" < "29.99"` because `"1" < "2"`. Order: $12.99, $129.99, $29.99, $49.99 | Products page toolbar | Data / Logic |
| H2 | `GET /api/products/detail` returns HTTP **201 Created** — wrong status code for a read operation | API Monitor, add-to-cart flow | API |
| H3 | Discount code "SAVE15" — API responds `{success:true, discount:0.15}` but total is **never updated** (discount value ignored in UI) | Cart page | API / UI discrepancy |
| H4 | Clicking "Place Order" twice rapidly creates **two duplicate orders** — button not disabled before async call | Cart page | Race condition / Data integrity |
| H5 | After 2 minutes, session expires — all API calls return `401 SESSION_EXPIRED` but UI gives **zero feedback** | Everywhere after 2min | API / UX |

#### Bonus Bugs (extra credit for sharp candidates)

| ID | Bug | Notes |
|----|-----|-------|
| B1 | Hidden $2.00 handling fee — `HANDLING_FEE = 2.00` added to total, no line item shown | Cart summary |
| B2 | Char counter off-by-one — shows 199 left when textarea is empty (should be 200) | Contact form |
| B3 | "Remove" button has `font-size: 10px` — too small to tap on mobile | Cart row |
| B4 | Sale badge: low-contrast text (`#ca8a04` on `#fef9c3`) | Phone Stand Flex card |
| B5 | Error states use only red colour — no icon, not accessible for colour-blind users | Form fields |
| B6 | Contact form API returns HTTP 200 with `success: false` for duplicate emails — wrong status code for an error | Contact /api/contact |
| B7 | UI only checks HTTP status (200), not `body.success` — shows "Message sent!" even for duplicate email API error | Contact form |
| B8 | No confirmation dialog before placing order | Cart - Place Order |

### MCQ Answer Key (Domain 9)

| Q | Correct | What it tests |
|---|---------|---------------|
| 1 | C | Bug N3 — out-of-stock item adds to cart |
| 2 | B | Bug N2 — invalid email accepted |
| 3 | D | Bug H3 — discount badge shows but total unchanged |
| 4 | B | Bug H1 — string sort order: $12.99, $129.99, $29.99, $49.99 |
| 5 | B | Bug H4 — double-submit creates 2 duplicate orders |
| 6 | D | Bug H5 — 401 with no UI feedback after session expiry |
| 7 | C | Bug B1 — hidden $2 handling fee |
| 8 | B | Bug H2 — GET endpoint returns 201 |

Encoded in `_K[8] = [233, 253, 14, 31, 46, 67, 83, 99]`.

---

## Security Measures

1. **IIFE isolation** — no global state for candidates to tamper with via console
2. **Wall-clock timer** — absolute deadline, immune to `Date.now` patching or `clearInterval` brute-force
3. **XOR answer key** — correct answers never readable in plain text
4. **FNV-1a signature** — `sessionStorage` edits between domains detected and flagged
5. **Domain lock** — signed `qa_submitted` flag prevents retaking even with DevTools
6. **Speed-run flag** — answers submitted in under 90 seconds are marked suspicious
7. **Tab-switch counter** — `visibilitychange` events counted, sent in submission

---

## Scoring

### Auto-graded (MCQs)
- 2 marks per correct single-answer MCQ
- Correct = exactly one selection matching the decoded key

### Manual review (Open tasks)
- 0–10 per task, reviewed by the QA team
- Rubrics are embedded in each task's `evalPrompt` field (used for optional AI eval via Cloudflare Worker)

### QA Playground scoring
- Open task 1 (Bug Hunt): scored by number and quality of bugs found
  - 0 bugs = 0, 1–2 = 2, 3–4 = 4, 5–6 = 5–6, 7–8 = 7–8, 9–10 = 9, 11+ = 10
- Open task 2 (Professional Bug Report): scored on structure, accuracy, severity, root cause, fix

---

## Split-Screen Implementation

When Domain 9 loads, `renderDomain()` detects `domain.playground === true` and calls `setupSplitMode()`:
- Adds `split-mode` class to `<body>`
- Injects `.split-right` div after `#assessmentCard` (contains macOS-style window bar + iframe)
- Injects compact timer bar at top of left panel
- Forces sticky timer strip visible
- CSS makes `main > .container` a flex row; `#assessmentCard` becomes the 42% left panel

On submit, `teardownSplitMode()` removes the injected elements and `split-mode` class before rendering the next domain (or redirecting to `thankyou.html` since Domain 9 is last).

---

## Git Remotes

| Remote | Account | URL |
|--------|---------|-----|
| `tester` (primary) | yadnesh-tester (company) | https://github.com/yadnesh-tester/qa-skill-check.git |
| `origin` | ysumbre10 (personal) | git@github.com:ysumbre10/starapps-qa-assessment.git |

**Always use `yadnesh-tester` for this project.** Do not switch back to `ysumbre10` after pushing.

Push commands:
```bash
# Company remote (primary)
gh auth switch --user yadnesh-tester
git -c credential.helper='!gh auth git-credential' push https://github.com/yadnesh-tester/qa-skill-check.git main

# Personal remote
git push origin main
```

---

## Config (gitignored)

`config.js` exports `window.QA_CONFIG` with:
```js
window.QA_CONFIG = {
  sheetsEndpoint:  'https://...',   // Google Apps Script Web App URL
  aiEvalEndpoint:  'https://...',   // Cloudflare Worker URL
};
```

Without `config.js`, the engine runs normally — submissions just skip the network calls.
