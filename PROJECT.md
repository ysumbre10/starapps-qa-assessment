# QA Skill Check

Browser-based QA assessment. 10 domains, 10 minutes each (30 min for QA Playground and AI Prompting). Pure HTML + Vanilla JS — no build step, runs from any static host or `file://`.

Deployed at: **https://qa-skill-check.pages.dev/**

---

## Files

```
index.html        Registration form
instructions.html Rules page
assessment.html   Assessment shell (timer, progress, questions)
thankyou.html     Score breakdown
demo-app.html     ShopLab — buggy e-commerce app (Domain 9 right panel)
assessment.js     Engine + all questions
style.css         Design system
config.js         Endpoints — gitignored (see Config section)
answers.md        Full answer key + rubrics — gitignored
worker.js         Cloudflare Worker — proxies task answers to Claude Haiku for AI scoring
wrangler.toml     Cloudflare Worker config (name: qa-eval)
sheets-receiver.gs          Live Apps Script — gitignored (contains real token)
sheets-receiver.example.gs  Committed reference copy (token redacted)
logo.png          Starapps Studio logo
```

---

## Domains

| # | Domain | MCQs | Tasks | Time | Max |
|---|--------|------|-------|------|-----|
| 1 | Manual Testing | 10 | 0 | 10 min | 20 |
| 2 | API Testing | 3 | 2 | 10 min | 26 |
| 3 | Back-End Testing | 3 | 2 | 10 min | 26 |
| 4 | DB Log Reading | 3 | 2 | 10 min | 26 |
| 5 | Test Automation | 3 | 2 | 10 min | 26 |
| 6 | Root Cause Analysis | 3 | 2 | 10 min | 26 |
| 7 | Complex Systems | 3 | 2 | 10 min | 26 |
| 8 | AI in QA | 3 | 2 | 10 min | 26 |
| 9 | QA Playground *(30 min)* | 3 | 4 | 30 min | 46 |
| 10 | AI Prompting *(30 min)* | 0 | 4 | 30 min | 40 |
| | **Total** | | | | **288** |

MCQ = 2 marks each. Open tasks = 0–10 each, AI-scored by Claude Haiku via Cloudflare Worker.

---

## Security

1. **IIFE** — zero globals; console cannot touch timer or answers
2. **Wall-clock timer** — absolute deadline, immune to `Date.now` spoofing or `clearInterval` brute-force
3. **XOR answer key** — correct answers never in plain text
4. **FNV-1a signature** — sessionStorage edits between domains detected and flagged
5. **Domain lock** — submitted flag is signed; DevTools reset of `qa_current_task` cannot re-enter
6. **Deadline cap** — `qa_domain_deadline` cannot be extended beyond `start + _domSecs() + 5s`
7. **Speed-run flag** — answers in under 15% of the allocated domain time marked suspicious
8. **Tab-switch counter** — `visibilitychange` events counted; warning shown at 3+
9. **Shared secret token** — `qaToken` in `config.js` sent as `X-QA-Token` header to Worker and as `token` field to Sheets; both endpoints reject requests without a valid token — prevents spam/fake submissions
10. **evalPrompt length cap** — Worker truncates `evalPrompt` to 4000 chars and `answer` to 8000 chars to prevent token abuse
11. **Score clamping** — Worker clamps Claude's returned score to `[0, 10]` regardless of model output
12. **Schema guard** — Apps Script verifies `HEADERS.length === FIELD_ORDER.length` before writing any row

---

## Data Flow

```
index.html        → sessionStorage: qa_candidate
instructions.html → sessionStorage: qa_current_task = 0
assessment.js     → sessionStorage: qa_responses, qa_timings, qa_sig, qa_integrity
[last domain]     → POST to Cloudflare Worker (AI eval) + POST to Google Sheets (flat row)
thankyou.html     → reads sessionStorage, renders score breakdown
```

---

## QA Playground (Domain 9 — 30 min)

Split-screen layout: left panel = MCQs + 4 open tasks, right panel = ShopLab iframe.

**Session timer:** ShopLab has a 2-minute simulated login session. After it expires, the header shows "Expired" in red and a **Re-login** button appears — clicking it resets the session so testers can continue exploring API features. The button only appears after expiry so candidates still encounter the silent-401 bug first.

### Task structure

| Task | Title | What to find |
|------|-------|-------------|
| 1 | UI & Visual Bugs | Visual/layout/accessibility bugs |
| 2 | API Bugs | Wrong status codes, missing validation, API misbehaviour |
| 3 | Functional Bugs | Logic errors affecting core user journeys |
| 4 | Any Other Bugs | Form validation, edge cases, anything not in 1–3 |

Each task: list bugs with name, location, and what is wrong. No reproduction steps required.

### Known bugs in ShopLab

| ID | Type | Description |
|----|------|-------------|
| N1 | Functional | Quantity counter goes negative — no minimum check |
| N2 | Validation | Contact form accepts invalid email (`type="text"`) |
| N3 | Functional | Out-of-stock items add to cart — no stock check |
| N4 | UI/A11y | USB-C Hub image broken, no `alt` attribute |
| N5 | Validation | Contact form submits with empty Name + Email |
| H1 | Data/Logic | Price sort is string-based — `"129.99" < "29.99"` |
| H2 | API | `GET /api/products/detail` returns **201** instead of 200 |
| H3 | API/UI | Discount badge shows but cart total unchanged |
| H4 | Race condition | Double-click Place Order creates 2 duplicate orders |
| H5 | API/UX | Session expires → 401 with zero UI feedback |
| B1 | Data | Hidden $2.00 handling fee, no line item shown |
| B2 | UI | Char counter off-by-one (shows 199 when 0 chars typed) |
| B3 | UI | Remove button `font-size: 10px` — too small on mobile |
| B4 | A11y | Low-contrast Sale badge text |
| B5 | A11y | Error states use colour only |
| B6 | API | Duplicate email returns 200 with `success: false` |
| B7 | UI/API | UI checks status only, shows success on API error |
| B8 | UX | No confirmation dialog before placing order |

Full answer key and rubrics → see `answers.md` (gitignored).

---

## Cloudflare Worker

Deployed at: `https://qa-eval.yadnesh.workers.dev`

- Receives task answers from the frontend on final submission
- Calls Claude Haiku (`claude-haiku-4-5-20251001`) in parallel via `Promise.allSettled`
- Returns `{ score: 0–10, feedback: "..." }` per task
- Max 25 tasks per request, 8000-char answer cap, 4000-char evalPrompt cap

```bash
# Deploy
wrangler deploy

# Set secrets
wrangler secret put CLAUDE_API_KEY   # Anthropic API key (sk-ant-...)
wrangler secret put QA_TOKEN         # Must match qaToken in config.js
```

---

## Google Sheets Receiver

Apps Script web app — receives the flat JSON row on final submit, appends to the `Submissions` sheet.

- **116 columns** total (5 candidate + 7 summary + 4 per domain × 8 standard + 16 QA Playground + 14 AI Prompting)
- Rows with `tampered=true` or `tabSwitches >= 3` highlighted amber
- Schema is guarded: script refuses to write if `HEADERS.length !== FIELD_ORDER.length`

**Setup / update steps:**
1. Open the Google Sheet → Extensions → Apps Script
2. Paste `sheets-receiver.gs` (the real file, not the `.example.gs`)
3. If updating schema: delete the `Submissions` tab first so the header row regenerates correctly
4. Deploy → New deployment (or Manage deployments → Edit → New version)
5. Copy the Web App URL → set as `QA_SHEETS_ENDPOINT` in Cloudflare Pages env vars

---

## Config

Create `config.js` (gitignored) at the project root:

```js
window.QA_CONFIG = {
  sheetsEndpoint: 'https://...',   // Google Apps Script Web App URL
  aiEvalEndpoint: 'https://...',   // Cloudflare Worker URL
  qaToken:        'qa-sk-...',     // Shared secret — must match Worker QA_TOKEN + Sheets TOKEN
};
```

Without `config.js` the engine runs normally — submissions skip network calls (useful for local dev).

---

## Git

| Remote | Account | Use |
|--------|---------|-----|
| `tester` | yadnesh-tester | Primary — Cloudflare Pages deploys from here |
| `origin` | ysumbre10 | Personal backup |

```bash
# Push to Cloudflare Pages remote
gh auth switch --user yadnesh-tester
git -c credential.helper='!gh auth git-credential' push https://github.com/yadnesh-tester/qa-skill-check.git main
```
