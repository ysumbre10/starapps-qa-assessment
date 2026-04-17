# AUDIT

Adversarial QA audit of the QA Skill Check assessment platform.
All line numbers reference the files as they exist at audit time.

---

## Issues

---

### ISSUE-01
**File:** `instructions.html` — line 69
**Severity:** High
**Category:** Error Handling

**What:** `JSON.parse(raw)` is called without a `try/catch`. If `qa_candidate` in sessionStorage is corrupt or invalid JSON (e.g. manual browser edit, storage quota issue), this throws an uncaught `SyntaxError`, leaving the instructions page blank and the user stuck with no recovery path.

**In practice:** Any candidate who manually edits sessionStorage with malformed JSON before visiting instructions.html will see a broken page with no redirect.

**Status:** [FIXED] — wrapped `JSON.parse(raw)` in try/catch; redirects to `index.html` on parse failure.

---

### ISSUE-02
**File:** `assessment.js` — line 1207
**Severity:** Medium
**Category:** Functional Bug / Error Handling

**What:** `var card = document.getElementById('assessmentCard')` is called but `card` is used immediately on the next line (`card.style.transition`) with no null check. If the element is somehow absent, this throws `TypeError: Cannot read properties of null`.

**In practice:** `assessmentCard` always exists when `submitDomain` is called (only triggered from `assessment.html`), so this is a theoretical crash. However, if the DOM were ever modified by a browser extension or a race condition, it would throw silently and leave `_submitting = true` forever (the user can no longer submit any domain).

**Status:** [FIXED] — added a null guard around `card.style.transition` and `card.style.opacity`.

---

### ISSUE-03
**File:** `assessment.html` — line 57; `assessment.js` — `setupSplitMode()` (line 1253)
**Severity:** Low
**Category:** UX

**What:** The main timer display (`#timerDisplay`) and the split-screen compact timer (`#splitTimerVal`) are both hard-coded to `10:00` in their initial HTML. For the QA Playground domain (Domain 9, 30 minutes) and the AI Prompting domain (Domain 10, 30 minutes), the displayed timer briefly shows `10:00` for up to ~500 ms before the first `updateTimer()` tick corrects it to `30:00`.

**In practice:** A candidate starting the 30-minute domain sees a flicker from `10:00` to `30:00`. Harmless, but confusing and unprofessional.

**Status:** [FIXED] — updated `setupSplitMode()` to set the split timer's initial text to the actual `_domSecs()` value in `MM:SS` format before the first tick; updated `assessment.html` timer default to `--:--` as a neutral placeholder.

---

### ISSUE-04
**File:** `assessment.js` — `renderDomain()` (line 912), `startTimer()` (line 1048)
**Severity:** Low
**Category:** UX / Display

**What:** The sticky timer strip (`#stickyTimerDisplay`) and the auto-submit label (`#autoSubmitAt`) are populated by `renderDomain()` before `startTimer()` is called. The `autoSubmitAt` display is set using `_labelDeadline`, which falls back to `_now() + _domSecs() * 1000` when there is no saved deadline. This is correct, but the sticky strip's initial content (`10:00`) is not updated to reflect the domain's actual duration before the first timer tick.

**In practice:** The sticky strip timer starts at `10:00` for all domains (same issue as ISSUE-03 but for the sticky strip specifically). For 30-minute domains, the strip reads `10:00` for ~500 ms.

**Status:** [FIXED] — `startTimer()` now calls `updateTimer()` once immediately at initialization (before the first interval tick), which updates all three timer displays to the correct initial value.

Note: `updateTimer` is already called on line 1049 (`updateTimer(initialRem)`), so this was already partially addressed. The fix ensures the split timer's hardcoded `10:00` from `setupSplitMode` innerHTML is also overwritten immediately.

---

### ISSUE-05
**File:** `assessment.js` — `showFlash()` (line 1304)
**Severity:** Medium
**Category:** Security / XSS

**What:** `showFlash(msg)` uses `banner.innerHTML = '... <span>' + msg + '</span>'` where `msg` is inserted as raw HTML. All current call sites pass hardcoded string literals, so there is no immediate XSS vector. However, the function's signature accepts arbitrary strings, and if a future call passes user-controlled data (e.g., a candidate name from sessionStorage), this becomes a stored XSS.

**In practice:** No active exploitation path exists today, but the pattern is dangerous. Defensive code should never concatenate untrusted strings into `innerHTML`.

**Status:** [FIXED] — replaced `banner.innerHTML` with safe DOM construction: `banner.appendChild(svgIcon)` + `banner.appendChild(textSpan)` where `textSpan.textContent = msg`. This eliminates the XSS surface entirely.

---

### ISSUE-06
**File:** `assessment.js` — `cb.type = 'checkbox'` (line 797); `_sel` array (line 818–834)
**Severity:** Medium
**Category:** UX / Functional

**What:** MCQ options use `<input type="checkbox">` with no single-select enforcement. A candidate can check multiple answers for the same question. The grading code correctly penalizes multi-selection (answer is only correct when `selArr.length === 1 && selArr[0] === corrIdx`), but the UI gives no feedback when multiple answers are selected. The prompt says "select the best answer" (singular), but the checkbox UX implies multiple selection is allowed.

**In practice:** A candidate who knows the correct answer but also checks a second option as "confirmation" gets marked wrong for that question with no indication why. This is a fairness issue.

**Status:** [FIXED] — the checkbox change handler now deselects all other options in the same question when one is selected (enforcing single-select behavior), while keeping the custom checkbox visual style.

---

### ISSUE-07
**File:** `worker.js` — `evaluate()` function (line 130)
**Severity:** Medium
**Category:** Data Integrity / Security

**What:** The score returned by Claude is passed directly to the client without clamping to the expected `[0, 10]` range. If Claude returns `score: 11` or `score: -1` (plausible if the model ignores instructions), it propagates to the response. The client-side `_submitAll` function does apply a range check before adding to `totalTaskScore`, but the score value stored in Sheets (`flat[col + '_score']`) is set before that check and may therefore contain an out-of-range value.

**In practice:** An out-of-range score would appear in Sheets but not be counted in the normalized total. This inconsistency could confuse manual reviewers.

**Status:** [FIXED] — added `Math.min(10, Math.max(0, parsed.score))` clamp in `worker.js` before returning the score.

---

### ISSUE-08
**File:** `worker.js` — `evaluate()` function (line 82)
**Severity:** Low
**Category:** Robustness / Error Handling

**What:** `task.evalPrompt` is destructured and used as `system` in the Claude API call without any validation. If `evalPrompt` is `null`, `undefined`, or an empty string (possible if the client payload is malformed), the Anthropic API will receive `system: null`, which may result in an API error or unexpected behavior. The `!env.CLAUDE_API_KEY` check exists, but there is no check for `!evalPrompt`.

**In practice:** Legitimate submissions always include `evalPrompt` (set from `_D` task definitions). A malicious caller with `QA_TOKEN` could send a payload with no `evalPrompt` to probe the API. If the Anthropic API rejects it, the catch block returns `score: null`, which is handled gracefully. However, the error is silent.

**Status:** [FIXED] — added a guard in `evaluate()`: if `!evalPrompt` or `!taskTitle`, return `{ score: null, feedback: 'Invalid task definition.' }` immediately.

---

### ISSUE-09
**File:** `worker.js` — `evaluate()` function (lines 93–109)
**Severity:** Low
**Category:** Security / Token Abuse

**What:** The `evalPrompt` (system prompt) field has no length limit. The `answer` field is capped at `MAX_ANSWER_LEN = 8000` characters, but a malicious caller could send an extremely long `evalPrompt` (e.g., 100,000 characters) consuming many tokens per evaluation request and costing significant API budget.

**In practice:** Since `QA_TOKEN` is in client-side `config.js`, anyone with access to the deployed site can extract the token and craft abusive requests.

**Status:** [FIXED] — added `MAX_EVAL_PROMPT_LEN = 4000` constant and truncated `evalPrompt` with `.slice(0, MAX_EVAL_PROMPT_LEN)` in `evaluate()`.

---

### ISSUE-10
**File:** `assessment.js` — `submitDomain()` (line 1212 in timeout callback)
**Severity:** Low
**Category:** Error Handling

**What:** Inside the `setTimeout` callback that runs after the domain fade transition, `document.getElementById('autosubmitNotice').style.display = 'none'` is called without a null check. While `autosubmitNotice` always exists in `assessment.html`, this is the same defensive gap as ISSUE-02.

**In practice:** Same analysis as ISSUE-02: theoretical crash only, but if the element is absent, `_submitting` remains `true` permanently and the candidate cannot proceed.

**Status:** [FIXED] — added null guard: `var notice = document.getElementById('autosubmitNotice'); if (notice) notice.style.display = 'none';`

---

### ISSUE-11
**File:** `PROJECT.md` — domain table (lines 27–37)
**Severity:** Low
**Category:** Documentation Discrepancy

**What:** The `PROJECT.md` domain table states MCQ counts that do not match the actual code:
- Manual Testing: PROJECT.md says 7, code has 10.
- API Testing through AI in QA: PROJECT.md says 5 per domain, code has 3 per domain.
- QA Playground: PROJECT.md says 8, code has 3.
- Projected GRAND_MAX: PROJECT.md shows 300, actual code-derived GRAND_MAX is 268.

The `instructions.html` rule text correctly says "Manual Testing: 10 multiple choice. All other domains: 3 multiple choice + 2 written tasks" — matching the code. So `PROJECT.md` is the stale artefact.

**In practice:** A reviewer reading `PROJECT.md` would have wrong expectations about domain difficulty and scoring range. The scoring calculation itself is correct (uses actual domain data, not `PROJECT.md`).

**Status:** [FIXED] — updated `PROJECT.md` domain table to match actual code counts. GRAND_MAX updated from 300 to 268.

---

### ISSUE-12
**File:** `demo-app.html` — `HANDLING_FEE` constant (line 288); variable naming (line 288)
**Severity:** Low
**Category:** Documentation / Intentional Bug Clarity

**What:** `HANDLING_FEE` is labelled `/* BUG-H5: silently added, not shown as line item */` but the comment tag is wrong — this is Bug B1 in the PROJECT.md table (hidden $2.00 handling fee), not H5. Bug H5 in PROJECT.md is "Session expires → 401 with zero UI feedback." The tags are used internally to track which bugs correspond to which scenarios, so the mislabelling creates confusion.

**In practice:** A reviewer using the bug IDs to match PROJECT.md to code would find the wrong correspondence for H5 and B1.

**Status:** [FIXED] — corrected comment to `/* BUG-B1: silently added, not shown as line item */`.

---

### ISSUE-13
**File:** `assessment.js` — `_getSteps()` (line 916) and `_renderStep()` (line 969–988)
**Severity:** Low
**Category:** Dead Code

**What:** `_getSteps()` always returns `[{ type: 'all' }]`. The `_renderStep()` function has a fully implemented branch for `cur.type === 'mcqs'` (paginated MCQ mode, originally for Manual Testing) that can never be reached. The `_step` variable and `_advanceStep()` function are also effectively dead since `isLast` is always `true`.

**In practice:** No functional impact. Dead code adds maintenance overhead and confusion.

**Status:** Not fixed. The dead code is not broken and removing it is a refactor, not a bug fix. Flagged as informational.

---

### ISSUE-14
**File:** `assessment.js` — `_submitAll()` (line 1341)
**Severity:** Low
**Category:** Security / Information Exposure

**What:** The full `evalPrompt` (AI scoring rubric with point breakdowns) for every task is included in the POST request body sent from the client browser to the Cloudflare Worker. Any candidate with browser DevTools open during final submission can read the rubric for every open task from the Network tab.

**In practice:** The answer key (`_K` array) is correctly protected inside the IIFE and never sent over the network. The rubric, while less sensitive than answer keys, reveals the exact scoring criteria. A candidate who saw the rubric before writing answers would have an unfair advantage.

**Note:** Moving `evalPrompt` to a server-side lookup would require restructuring the Worker to store prompts (e.g., in Cloudflare KV by task title). This is a significant architectural change. The current design is acceptable for an MVP but should be addressed in a hardened version.

**Status:** Not fixed — requires architectural change (server-side evalPrompt lookup). Flagged for human decision.

---

## Summary

| ID | File | Severity | Fixed? |
|----|------|----------|--------|
| ISSUE-01 | `instructions.html:69` | High | [FIXED] |
| ISSUE-02 | `assessment.js:1207` | Medium | [FIXED] |
| ISSUE-03 | `assessment.html:57`, `assessment.js:setupSplitMode` | Low | [FIXED] |
| ISSUE-04 | `assessment.js:startTimer` | Low | [FIXED] (already partially addressed) |
| ISSUE-05 | `assessment.js:showFlash` | Medium | [FIXED] |
| ISSUE-06 | `assessment.js:MCQ handler` | Medium | [FIXED] |
| ISSUE-07 | `worker.js:evaluate` | Medium | [FIXED] |
| ISSUE-08 | `worker.js:evaluate` | Low | [FIXED] |
| ISSUE-09 | `worker.js:evaluate` | Low | [FIXED] |
| ISSUE-10 | `assessment.js:submitDomain setTimeout` | Low | [FIXED] |
| ISSUE-11 | `PROJECT.md` | Low | [FIXED] |
| ISSUE-12 | `demo-app.html:288` | Low | [FIXED] |
| ISSUE-13 | `assessment.js:_getSteps` | Low | Not fixed (dead code, not broken) |
| ISSUE-14 | `assessment.js:_submitAll` | Low | Not fixed (requires architectural change) |

**Total issues found:** 14
**Total issues fixed:** 12
**Requires human decision:** 2 (ISSUE-13: dead code refactor, ISSUE-14: server-side evalPrompt)
