# QA Skill Check

Browser-based QA assessment. 10 domains, 10 minutes each (30 min for QA Playground and AI Prompting). Pure HTML + Vanilla JS — no build step, runs from any static host or `file://`.

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
logo.png          Starapps Studio logo
```

---

## Domains

<!-- FIX ISSUE-11: corrected MCQ counts and GRAND_MAX to match actual code (were stale: 7/5/5/5/5/5/5/5/8 MCQs, total 300) -->
| # | Domain | MCQs | Tasks | Max |
|---|--------|------|-------|-----|
| 1 | Manual Testing | 10 | 0 | 20 |
| 2 | API Testing | 3 | 2 | 26 |
| 3 | Back-End Testing | 3 | 2 | 26 |
| 4 | DB Log Reading | 3 | 2 | 26 |
| 5 | Test Automation | 3 | 2 | 26 |
| 6 | Root Cause Analysis | 3 | 2 | 26 |
| 7 | Complex Systems | 3 | 2 | 26 |
| 8 | AI in QA | 3 | 2 | 26 |
| 9 | QA Playground *(30 min)* | 3 | 2 | 26 |
| 10 | AI Prompting *(30 min)* | 0 | 4 | 40 |
| | **Total** | | | **268** |

MCQ = 2 marks each. Open tasks = 0–10 each, reviewed by team.

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
9. **Shared secret token** — `qaToken` in `config.js` sent as `X-QA-Token` header to Worker and as `token` field to Sheets; both endpoints reject requests without a valid token — prevents spam/fake submissions from anyone who only knows the endpoint URL

---

## Data Flow

```
index.html        → sessionStorage: qa_candidate
instructions.html → sessionStorage: qa_current_task = 0
assessment.js     → sessionStorage: qa_responses, qa_timings, qa_sig, qa_integrity
[last domain]     → Google Sheets (flat row) + Cloudflare Worker (AI eval)
thankyou.html     → reads sessionStorage, renders score breakdown
```

---

## QA Playground (Domain 9 — 30 min)

Split-screen: left = questions, right = ShopLab iframe.

### Bugs

| ID | Type | Description |
|----|------|-------------|
| N1 | Functional | Quantity counter goes negative — no minimum check |
| N2 | Validation | Contact form accepts invalid email (`type="text"`) |
| N3 | Functional | Out-of-stock items add to cart — no stock check |
| N4 | UI/A11y | USB-C Hub image broken, no `alt` attribute |
| N5 | Validation | Contact form submits with empty Name + Email |
| H1 | Data/Logic | Price sort is string-based — `"129.99" < "29.99"` |
| H2 | API | `GET /api/products/detail` returns **201** |
| H3 | API/UI | Discount badge shows but cart total unchanged |
| H4 | Race condition | Double-click Place Order creates 2 duplicate orders |
| H5 | API/UX | Session expires → 401 with zero UI feedback |
| B1 | Data | Hidden $2.00 handling fee, no line item shown |
| B2 | UI | Char counter off-by-one (shows 199 when empty) |
| B3 | UI | Remove button `font-size: 10px` — too small on mobile |
| B4 | A11y | Low-contrast Sale badge text |
| B5 | A11y | Error states use colour only |
| B6 | API | Duplicate email returns 200 with `success: false` |
| B7 | UI/API | UI checks status only, shows success on API error |
| B8 | UX | No confirmation dialog before placing order |

### MCQ Answer Key (Domain 9)

| Q | Answer | Tests |
|---|--------|-------|
| 1 | C | Bug N3 |
| 2 | B | Bug N2 |
| 3 | D | Bug H3 |
| 4 | B | Bug H1 |
| 5 | B | Bug H4 |
| 6 | D | Bug H5 |
| 7 | C | Bug B1 |
| 8 | B | Bug H2 |

Full answer key for all domains → see `answers.md` (gitignored).

---

## Config

Create `config.js` (gitignored) at the project root:

```js
window.QA_CONFIG = {
  sheetsEndpoint: 'https://...',               // Google Apps Script Web App URL
  aiEvalEndpoint: 'https://...',               // Cloudflare Worker URL
  qaToken:        'qa-sk-...',                 // Shared secret (openssl rand -hex 20)
};
```

Without `config.js` the engine runs normally — submissions skip network calls.

### Cloudflare Worker secrets

```bash
wrangler secret put CLAUDE_API_KEY   # Anthropic API key
wrangler secret put QA_TOKEN         # Must match qaToken in config.js
```

### Google Apps Script token check

The `doPost` function in the Apps Script must validate the token:

```javascript
function doPost(e) {
  var TOKEN = 'qa-sk-85d653b918b6c164544780491a628b8a69cbbe00'; // keep in sync with config.js
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) {
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }
    // ... rest of doPost (appendRow etc.)
  } catch(err) {
    return ContentService.createTextOutput('Error: ' + err).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

After editing the Apps Script, create a **new deployment** (Deploy → New deployment) — editing does not update an existing deployment.

---

## Git

| Remote | Account | Use |
|--------|---------|-----|
| `tester` | yadnesh-tester | Primary — always use this |
| `origin` | ysumbre10 | Personal backup |

```bash
# Push to company remote
gh auth switch --user yadnesh-tester
git -c credential.helper='!gh auth git-credential' push https://github.com/yadnesh-tester/qa-skill-check.git main
```
