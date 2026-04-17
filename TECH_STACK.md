# TECH STACK

## Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Language | Vanilla JavaScript (ES5-compatible) | No transpilation |
| Language | HTML5 | semantic, `novalidate` on forms where JS validates |
| Language | CSS3 | custom properties, grid, flexbox |
| Runtime (frontend) | Browser — static file or any static host | No Node.js on client |
| Runtime (backend) | Cloudflare Workers | Service Worker environment, `compatibility_date = 2025-04-01` |
| Fonts | Google Fonts (Syne, IBM Plex Mono, DM Sans) | loaded via `@import` from `style.css` |
| AI model | `claude-haiku-4-5-20251001` (Anthropic) | via Cloudflare Worker → Anthropic REST API |
| Build tooling | Node.js script (`build-config.js`) | only used at deploy time to write `config.js` |
| Deploy config | `wrangler.toml` | worker name `qa-eval`, main `worker.js` |
| Storage (client) | `sessionStorage` | all candidate state, answers, timings, integrity flags |
| Storage (backend) | Google Apps Script Web App | receives flat-row POST, writes to Google Sheets |

No npm, no bundler, no framework. The entire frontend ships as raw `.html`, `.css`, and `.js` files.

---

## Architecture Overview

```
index.html          Registration page — collects name/email/experience/role
instructions.html   Rules page — shows registered candidate, starts timer
assessment.html     Shell page — contains the timer strip, progress bar, card
  assessment.js       IIFE engine: renders questions, grades MCQs, submits
thankyou.html       Score breakdown — reads sessionStorage + window.DOMAINS
demo-app.html       ShopLab — intentionally buggy e-commerce app (iframe in split mode)
style.css           Shared design system
config.js           Generated at build time (gitignored), injected before assessment.js
worker.js           Cloudflare Worker — proxies Claude API, validates token
build-config.js     Node.js build script — reads env vars, writes config.js
```

### Frontend

- Pure static files; no runtime server required.
- All assessment logic lives inside the IIFE in `assessment.js`.
- `window.QA_CONFIG` (from `config.js`) is the only global injected before the IIFE runs.
- `window.DOMAINS` is the only global the IIFE exposes (metadata only — no questions, no answer key, no eval prompts).

### Backend

- **Cloudflare Worker** (`worker.js`): receives POST requests with candidate answers, validates `X-QA-Token` header, calls Anthropic API in parallel to score open tasks, returns JSON scores.
- **Google Apps Script**: receives a flat-row POST from the client after the final domain is submitted. Writes one row per submission to a Google Sheets spreadsheet.

---

## External Dependencies

| Service | Purpose | Where configured |
|---------|---------|-----------------|
| Anthropic Claude API | Score open-task answers via LLM | `CLAUDE_API_KEY` secret in Cloudflare Worker |
| Google Apps Script Web App | Persist full submission to Google Sheets | `QA_SHEETS_ENDPOINT` env var → `config.js` |
| Google Fonts | Syne, IBM Plex Mono, DM Sans typography | CSS `@import` (CDN, no key needed) |
| Cloudflare Workers | Host and run `worker.js` | `wrangler.toml`, `QA_TOKEN` Worker secret |

---

## Data Flow

```
1. index.html (registration)
   → sessionStorage.setItem('qa_candidate', JSON)         candidate info
   → sessionStorage.setItem('qa_responses', '{}')
   → sessionStorage.setItem('qa_timings',   '{}')
   → navigate to instructions.html

2. instructions.html
   → reads qa_candidate to show name
   → sessionStorage.setItem('qa_current_task', '0')
   → navigate to assessment.html

3. assessment.html + assessment.js (IIFE)
   Each domain submit:
     → grades MCQs against XOR-decoded answer key
     → collects textarea answers
     → sessionStorage.setItem('qa_responses', ...)        MCQ results + task text
     → sessionStorage.setItem('qa_timings',   ...)        seconds spent
     → sessionStorage.setItem('qa_sig', ...)              FNV-1a tamper signature
     → sessionStorage.setItem('qa_current_task', N+1)
   Final domain submit (additional steps):
     → sessionStorage.setItem('qa_submitted', '1')
     → sessionStorage.setItem('qa_submitted_sig', ...)
     → sessionStorage.setItem('qa_integrity', ...)        tampered + tabSwitches
     → POST to Cloudflare Worker (AI eval, parallel)      X-QA-Token header
       ← JSON { scores: [{ domain, taskTitle, score, feedback }] }
       → sessionStorage.setItem('qa_ai_scores', ...)
     → POST to Google Sheets (no-cors)                    token in body
     → navigate to thankyou.html

4. thankyou.html
   → reads DOMAINS (window.DOMAINS from assessment.js)
   → reads qa_responses, qa_timings, qa_ai_scores, qa_integrity
   → renders score breakdown (normalized to /100)
```

---

## Key Files

| File | Role |
|------|------|
| `assessment.js` | Core IIFE — all domain data, MCQ answer key (XOR-encoded), timer, grading, submission, integrity |
| `assessment.html` | Shell: timer ring, progress bar, sticky timer strip, MCQ/task containers |
| `worker.js` | Cloudflare Worker — token auth, Claude API proxy, task scoring |
| `style.css` | Design system — dark theme, all component styles, split-mode layout |
| `index.html` | Registration form with inline validation JS and Terms modal |
| `instructions.html` | Rules page + begin/resume button |
| `thankyou.html` | Score breakdown — reads all sessionStorage state + DOMAINS global |
| `demo-app.html` | ShopLab — intentionally buggy demo e-commerce app (rendered in iframe for Domain 9) |
| `config.js` | Runtime config (gitignored) — sheetsEndpoint, aiEvalEndpoint, qaToken |
| `config.example.js` | Template for config.js |
| `build-config.js` | Node build script — generates config.js from env vars |
| `wrangler.toml` | Cloudflare Worker deployment config |
| `PROJECT.md` | Internal project documentation (partly stale vs. actual code) |
| `answers.md` | Full answer key + rubrics (gitignored) |

---

## Environment Variables

| Variable | Where set | Controls | Fallback |
|----------|-----------|----------|----------|
| `QA_SHEETS_ENDPOINT` | Hosting platform env (Netlify/Vercel/CF Pages) | Google Apps Script Web App URL in `config.js` | `''` (empty string — Sheets submission skipped) |
| `QA_AI_EVAL_ENDPOINT` | Hosting platform env | Cloudflare Worker URL in `config.js` | `''` (empty string — AI eval skipped) |
| `QA_TOKEN` | Hosting platform env AND Cloudflare Worker secret | Shared secret sent as `X-QA-Token` header and `token` body field; both endpoints reject mismatches | `''` — `build-config.js` exits with code 1 if endpoints are set but token is missing |
| `CLAUDE_API_KEY` | Cloudflare Worker secret (`wrangler secret put`) | Anthropic API key used by `worker.js` | None — worker returns 500 if missing |
