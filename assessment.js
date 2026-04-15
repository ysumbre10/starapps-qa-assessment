/* =============================================================
   QA Skill Check — Assessment Engine + Questions (v4 — hardened)
   Security measures:
     1. IIFE — zero global vars; console cannot touch timer/answers
     2. Wall-clock deadline timer — decrement trick disabled
     3. XOR-encoded answer key — correct answers hidden from source
     4. FNV-1a signed sessionStorage — tampering detected on results page
     5. Minimum-time flag — speed-runs marked suspicious
     6. Domain-lock guard — completed domains cannot be re-entered
   ============================================================= */

(function () {
  'use strict';

  /* ── Config — loaded from config.js (gitignored) ──────────── */
  var _cfg             = (typeof window !== 'undefined' && window.QA_CONFIG) || {};
  var SHEETS_ENDPOINT  = _cfg.sheetsEndpoint  || '';
  var AI_EVAL_ENDPOINT = _cfg.aiEvalEndpoint  || '';

  /* ── Freeze timing primitives before any user code can spoof them
     Captures Date.now at IIFE init — console overrides of Date.now
     after this point have zero effect on timer or time-used tracking. */
  var _Date = Date;
  var _now  = _Date.now.bind(_Date);

  /* ─────────────────────────────────────────────────────────────
     QUESTIONS — correct answers removed from here, stored encoded
     in _K below. Options labels match display only.
     ───────────────────────────────────────────────────────────── */
  var _D = [

    /* ── 1. API TESTING ───────────────────────────────────────── */
    {
      id: 1,
      domain: 'API Testing',
      mcqs: [
        {
          q: 'A client sends POST /orders and the server creates a new order. Which HTTP status code is the most semantically correct response?',
          options: [
            '200 OK — request succeeded',
            '201 Created — resource was created',
            '202 Accepted — request is being processed',
            '204 No Content — success with no body'
          ]
        },
        {
          q: 'You send the exact same POST /payments request twice using the same idempotency_key. What should the server return on the second call?',
          options: [
            '400 Bad Request — duplicate submission detected',
            '409 Conflict — the resource already exists',
            '200 OK with the original response — idempotent replay',
            '422 Unprocessable Entity — semantically invalid'
          ]
        },
        {
          q: 'Which of these is an IDOR (Insecure Direct Object Reference) test case for GET /api/users/{id}/orders?',
          options: [
            'Send the request without an Authorization header and expect 401',
            'Send the request with an expired JWT and expect 401',
            "Send the request with User A's valid token but User B's {id} and expect 403",
            'Send the request with a malformed {id} value like "abc" and expect 400'
          ]
        }
      ],
      tasks: [
        {
          title: 'Design Test Cases for a Search API',
          scenario: 'GET /api/v1/products/search\n\nQuery params: q (search term), category, min_price, max_price, sort (asc|desc), page, limit\n\nReturns: { results: [...], total: 0, page: 1, has_more: false }',
          question: 'Write 8 test cases. For each: input params → expected status → expected behaviour → what bug it catches.\n\nCover: happy path, empty results, boundary prices, invalid sort value, SQL injection in q, missing required params, and pagination edge cases.',
          placeholder: 'TC-01: ...\nTC-02: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a search API test plan. Score 0–10: coverage of happy path, empty results, boundary prices, invalid sort value, SQL injection in q, missing required params, and pagination edge cases (5 pts); correctness of expected statuses and behaviors (3 pts); clarity and structure (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Debug a Flaky 401 on a Valid Token',
          scenario: 'GET /api/v1/me returns 401 Unauthorized roughly 1 in every 15 requests. The JWT is valid, not expired, and signed correctly. The issue only happens in production under normal load. No recent auth service changes.',
          question: 'List your top 3 hypotheses (e.g. clock skew, load balancer, caching).\n\nFor each: what evidence confirms it, what rules it out, and what you would check in logs or infra.\n\nWhat regression test cases would catch this in future?',
          placeholder: 'Hypothesis 1: ...\nHypothesis 2: ...\nHypothesis 3: ...',
          evalPrompt: 'You are a senior QA/backend engineer evaluating a debugging analysis for an intermittent 401 error. Score 0–10: quality of hypotheses (clock skew, load balancer sticky sessions, token validation race condition, caching) (4 pts), investigation methodology (3 pts), regression test cases proposed (2 pts), overall reasoning quality (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 2. BACK-END TESTING ──────────────────────────────────── */
    {
      id: 2,
      domain: 'Back-End Testing',
      mcqs: [
        {
          q: 'A background job runs nightly and processes 50,000 records. It exits with code 0 (success) but only 49,203 records are updated in the DB. No errors in logs. What is the most likely cause?',
          options: [
            'The job ran out of memory and was silently killed mid-execution',
            'A try/catch block is swallowing exceptions, causing silent skips',
            'The database ran out of connections and dropped some writes',
            'The job processed duplicates, reducing the effective update count'
          ]
        },
        {
          q: 'Which test type gives the highest confidence that a newly refactored payment service still works correctly end-to-end?',
          options: [
            'Unit tests — they run fast and isolate every function',
            'Contract tests — they verify the API schema hasn\'t changed',
            'Integration tests — they test the service against real dependencies',
            'Smoke tests — they verify the service starts and returns 200'
          ]
        },
        {
          q: 'A service has 100% unit test coverage but still fails in staging. What is the most likely reason?',
          options: [
            'The unit tests were written incorrectly and contain bugs',
            '100% coverage measures lines executed, not correctness of behaviour',
            'Staging uses a different OS than development, causing runtime differences',
            'The CI pipeline skipped some test files due to a config error'
          ]
        }
      ],
      tasks: [
        {
          title: 'Investigate Silent Data Loss in a Kafka Consumer',
          scenario: 'The order service emits ~500 order_created events/hour to a Kafka topic. The inventory service consumes the same topic and should update stock for each order. After a deploy, inventory updates ~460/hour. No errors in logs. Dead letter queue is empty. Consumer group lag is near zero.',
          question: 'List your investigation steps in priority order.\n\nFor each step: what are you checking, why, what confirms your hypothesis, what rules it out.\n\nThen write 2 test cases that would catch this in a CI pipeline before it hits production.',
          placeholder: 'Step 1: ...\nStep 2: ...',
          evalPrompt: 'You are a senior backend/QA engineer evaluating a debugging approach for silent Kafka message loss. Score 0–10: quality of hypotheses (idempotency filter, partition assignment, deserialization silently failing, consumer offset issue) (4 pts), investigation methodology and priority ordering (3 pts), test cases proposed (2 pts), reasoning quality (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Spot the Regression Risk in a Pricing Refactor',
          scenario: 'Original code applies discounts sequentially:\n  1. Loyalty discount: 10% off subtotal\n  2. Coupon: flat $5 off\n  3. Bulk: 5% off if qty > 10\n\nNew code: calculates all three discount amounts in parallel, then sums and subtracts once.\n\nAll unit tests pass.',
          question: 'Is the new code mathematically equivalent to the original? Show your working with a concrete example (e.g. subtotal=$100, qty=12).\n\nWrite 3 test cases with specific inputs and expected outputs that would expose any difference between the two approaches.',
          placeholder: 'Are they equivalent? ...\nTC-01: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a regression analysis for a pricing engine refactor. The correct answer is that the math is NOT equivalent — sequential discounts compound (percentage discounts apply to already-reduced prices) while parallel discount summing does not. Score 0–10: correct identification of the compounding vs parallel issue (4 pts), quality of test cases with correct expected values (4 pts), clarity of explanation (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 3. DB LOG READING ────────────────────────────────────── */
    {
      id: 3,
      domain: 'DB Log Reading',
      mcqs: [
        {
          q: 'EXPLAIN ANALYZE shows: "rows=12 (actual rows=94,830)". What does this mean and what should you do?',
          options: [
            'The query returned 94,830 rows instead of the 12 expected — there is a logic bug in the WHERE clause',
            'The query planner underestimated the row count — run ANALYZE to update table statistics',
            'The index is corrupt — the query planner used the wrong index and needs to be rebuilt',
            'The query is correct — planner estimates are always conservative and should be ignored'
          ]
        },
        {
          q: 'You see this in production logs:\n"lock wait timeout exceeded; try restarting transaction"\n\nWhat is happening and what is the correct first response?',
          options: [
            'The database server ran out of RAM — restart the DB service',
            'A long-running transaction is holding a lock that another transaction is waiting for — identify and investigate the blocking query',
            'The network between app and DB is slow — increase lock_wait_timeout in config',
            'The table has too many indexes — drop unused indexes to reduce write contention'
          ]
        },
        {
          q: 'A query runs in 8ms in staging (500K rows) but takes 6,200ms in production (18M rows). EXPLAIN shows "Index Scan" in staging, "Seq Scan" in production. Why?',
          options: [
            'The index was not deployed to production — run the migration script',
            'The query planner decided the index was not selective enough for 18M rows given the current filter — check index coverage and data distribution',
            'Production has slower disks than staging — upgrade to SSD storage',
            'The query uses SELECT * which disables index usage in large tables'
          ]
        }
      ],
      tasks: [
        {
          title: 'Diagnose This Production Log Sequence',
          scenario: "14:32:01 [WARN]  Slow query 4,312ms — SELECT * FROM orders WHERE user_id=9182 AND status='PENDING'\n14:32:04 [ERROR] Deadlock detected — tables: orders, order_items\n14:32:04 [ERROR] Transaction rollback: order_id=78234 (lock wait timeout)\n14:32:05 [INFO]  Retry 1/3 for order_id=78234\n14:32:09 [ERROR] Max retries reached — order_id=78234 set to FAILED",
          question: 'Walk through exactly what happened, step by step, in plain English.\n\nWhat is the root cause? What would you tell the developer to fix? Write 3 regression test cases that would catch this before it hits production again.',
          placeholder: 'What happened: ...\nRoot cause: ...\nFix: ...\nTC-01: ...',
          evalPrompt: 'You are a senior DB/QA engineer evaluating an analysis of a deadlock log. The correct interpretation: a slow query (missing index on status column) held locks; a concurrent transaction caused a deadlock; retry logic was exhausted and the order failed. Score 0–10: correct event sequence interpretation (3 pts), correct root cause identification (3 pts), developer report quality (2 pts), test case quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Pre-Migration Risk Assessment',
          scenario: "Migration to run on Friday on orders table (50M rows, 500 writes/sec peak):\n\n  ALTER TABLE orders ADD COLUMN fulfilled_by VARCHAR(100) NOT NULL DEFAULT 'system';\n  CREATE INDEX CONCURRENTLY idx_orders_fulfilled ON orders(fulfilled_by);",
          question: 'What are the top 3 risks of running this on a live 50M-row table?\n\nWrite a 5-point pre-migration checklist. Write a rollback plan. What would you verify in staging first?',
          placeholder: 'Risk 1: ...\nRisk 2: ...\nChecklist: ...\nRollback: ...',
          evalPrompt: 'You are a senior DBA/QA engineer evaluating a migration test plan. Key concerns: NOT NULL + DEFAULT on 50M rows causes table rewrite in older Postgres; CREATE INDEX CONCURRENTLY is correct but takes time; disk space for index; replication lag; live write traffic impact. Score 0–10: identification of key risks (4 pts), checklist quality (3 pts), rollback plan and staging validation strategy (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 4. TEST AUTOMATION ───────────────────────────────────── */
    {
      id: 4,
      domain: 'Test Automation',
      mcqs: [
        {
          q: 'Your Playwright test passes locally 100% of the time but fails in CI 30% of the time with "element not found". The element loads after an API call. What is the correct fix?',
          options: [
            'Add await page.waitForTimeout(2000) before the assertion to give CI more time',
            'Use await expect(locator).toBeVisible() which auto-retries until the element appears or timeout is reached',
            'Increase the global testTimeout in playwright.config.ts from 30s to 120s',
            'Add a try/catch around the assertion and retry the action up to 3 times'
          ]
        },
        {
          q: 'You inherit a suite with 200 tests, 40 of which are "flaky". A senior engineer says "delete all flaky tests, they waste time." What is the correct response?',
          options: [
            'Agree — flaky tests erode trust in the suite and should be removed immediately',
            'Agree — but only delete tests that have been flaky for more than 30 days',
            'Disagree — quarantine flaky tests in a separate suite, fix them by root cause (async, shared state, env issues), never delete without investigation',
            'Disagree — run each flaky test 5 times and only fail the build if it fails 3 or more times'
          ]
        },
        {
          q: 'Which selector strategy is most resilient when the UI undergoes a redesign that changes class names and layout?',
          options: [
            'page.locator(".checkout-btn") — CSS class selector',
            'page.locator("//div[@class=\'container\']/button[2]") — XPath positional selector',
            'page.getByTestId("checkout-btn") — data-testid attribute selector',
            'page.getByText("Checkout") — visible text selector'
          ]
        }
      ],
      tasks: [
        {
          title: 'Write Automation for a Multi-Step Checkout',
          scenario: 'Checkout flow:\n  Step 1: Cart page — items listed, "Proceed to Checkout" button [data-testid="checkout-btn"]\n  Step 2: Address form — name, street, city, postcode [data-testid="addr-name", "addr-street", "addr-city", "addr-postcode"]\n  Step 3: Payment — card number, expiry MM/YY, CVV [data-testid="card-num", "card-expiry", "card-cvv", "pay-btn"]\n  Step 4: Confirmation — "Order confirmed!" heading, order ID [data-testid="order-id"]',
          question: 'Write a Playwright or Cypress test for:\n(a) Happy path — cart to confirmed order, assert order ID is displayed\n(b) Declined payment — assert user stays on payment page with an error message\n\nState your framework. Write clean code with correct assertions.',
          placeholder: '// Framework: Playwright\n\ntest("checkout happy path", async ({ page }) => {\n  ...\n});',
          evalPrompt: 'You are a senior SDET evaluating automation test code for a multi-step checkout flow. Score 0–10: correct use of async/await and framework-appropriate syntax (2 pts), use of data-testid selectors (2 pts), happy path completeness including order ID assertion (2 pts), negative test (declined payment) quality (2 pts), overall code readability and structure (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Diagnose and Fix a Brittle Test Suite',
          scenario: 'An automation suite has these problems:\n  1. Tests pass locally, fail in CI ~25% of the time\n  2. Running tests in a different order changes results\n  3. Changing "Submit" button text to "Confirm" broke 52 tests\n  4. Full suite takes 55 minutes, blocking every deployment',
          question: 'For each of the 4 problems: identify the exact root cause and write a specific, actionable fix (not just "write better tests").\n\nThen: what test pyramid ratio (unit/integration/e2e) would you recommend for this team going forward, and why?',
          placeholder: 'Problem 1 — Root cause: ... Fix: ...\nProblem 2 — Root cause: ... Fix: ...',
          evalPrompt: 'You are a senior SDET evaluating automation troubleshooting advice. Expected answers: CI flakiness → async waits / environment consistency; test order dependency → shared state / teardown / isolated test data; brittle text selectors → data-testid or role-based selectors; slow suite → parallel execution / test pyramid / selective runs. Score 0–10: correct root cause per problem (4 pts), specific actionable fixes (4 pts), test pyramid recommendation quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 5. ROOT CAUSE ANALYSIS ───────────────────────────────── */
    {
      id: 5,
      domain: 'Root Cause Analysis',
      mcqs: [
        {
          q: 'A bug is reported: "Checkout crashes on iOS 16 Safari, works everywhere else." After 3 hours you cannot reproduce it locally. What is your best next action?',
          options: [
            'Close the ticket as "cannot reproduce" and ask the user to provide more steps',
            'Deploy extra logging to the production checkout flow and wait for the next occurrence with real context',
            'Copy the production database to staging and test all iOS 16 Safari paths manually',
            'Rollback the last 3 deployments to identify which change introduced the bug'
          ]
        },
        {
          q: 'Which of these is a correct application of 5-Whys to: "The payment service went down for 40 minutes"?',
          options: [
            'Why → server crashed. Root cause: bad server. Fix: replace it.',
            'Why → server crashed → Why → disk full → Why → logs not rotated → Why → no log rotation policy → Why → not in deployment checklist. Root cause: missing ops process.',
            'Why → server crashed → Why → too much traffic → Root cause: need auto-scaling.',
            'Why → server crashed → Why → a bad deploy → Root cause: need better code review.'
          ]
        },
        {
          q: 'A race condition bug occurs 1 in every 400 runs of a test. Which approach most reliably catches it in CI?',
          options: [
            'Add a 500ms sleep between the two racing operations',
            'Run the affected test 400 times in parallel in CI and fail if any run fails',
            'Use thread sanitizers, stress testing tools, or artificial delay injection to amplify timing windows',
            'Mark the test as expected-to-fail (xfail) and document the race condition for later'
          ]
        }
      ],
      tasks: [
        {
          title: 'RCA: iOS 16 Safari Checkout Bug',
          scenario: 'Bug report: "Place Order button does nothing on iPhone 14 (iOS 16.4 Safari). No error shown to user. Works on: Chrome desktop, Firefox desktop, Android Chrome, iOS 15 Safari. Broken on: all iOS 16 Safari devices tested (3 users confirmed)."',
          question: 'Apply 5-Whys to the technical root cause.\n\nThen apply 5-Whys separately to the PROCESS failure — why did QA not catch this before release?\n\nPropose 2 specific process changes that would prevent this class of bug in future.',
          placeholder: 'Technical 5-Whys:\nWhy 1: ...\n\nProcess 5-Whys:\nWhy 1: ...\n\nProcess changes: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a root cause analysis for a platform-specific bug. The technical root cause is likely a CSS/JS change incompatible with Safari iOS 16 (e.g., passive event listeners, scroll behavior, or a specific CSS property). The process failure is lack of cross-browser/cross-OS test coverage in the regression suite. Score 0–10: technical 5-Whys quality and depth (3 pts), technical investigation specificity (2 pts), process failure 5-Whys quality (3 pts), prevention recommendations (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Write a Post-Mortem Report',
          scenario: 'Incident timeline:\n  14:32 — Config change pushed to production (no review)\n  14:34 — Payment error rate jumps from 0.1% → 89%\n  14:38 — PagerDuty alert fires\n  14:58 — Root cause found: DB max_connections set to 2 (was 50)\n  15:01 — Config reverted\n  15:19 — Full recovery\n\nImpact: 47 mins degraded. 1,240 failed transactions. ~$43,000 revenue impact.',
          question: 'Write a complete post-mortem with: Summary, Timeline, Root Cause, Contributing Factors, Action Items (minimum 4, each with owner role and deadline).\n\nBe concise. This goes to engineering and leadership.',
          placeholder: 'Summary: ...\nTimeline: ...\nRoot Cause: ...\nContributing Factors: ...\nAction Items: ...',
          evalPrompt: 'You are a senior engineering manager evaluating a post-mortem report. Score 0–10: clear factual summary (1 pt), accurate timeline (2 pts), root cause AND contributing factors — not just "someone pushed bad config" but also: no config review process, no staging validation, no automated config validation (3 pts), impact statement with numbers (1 pt), quality and specificity of action items with owner roles and deadlines (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 6. COMPLEX SYSTEMS ───────────────────────────────────── */
    {
      id: 6,
      domain: 'Complex Systems',
      mcqs: [
        {
          q: 'Service A → B → C. Service C becomes slow (p99 = 9s). Which pattern stops this from making Service A unresponsive?',
          options: [
            "Retry with exponential backoff on Service A's calls to B",
            "Circuit breaker on Service B's calls to C — after N failures it opens and returns a fast fallback",
            "Increase HTTP timeout on Service A's calls to B from 5s to 30s",
            'Add a synchronous health-check endpoint on Service C that B polls every second'
          ]
        },
        {
          q: "A user's data appears in Region A immediately after creation but is missing in Region B for ~8 seconds. There are no errors. What is the most likely explanation?",
          options: [
            'The CDN is caching a stale API response in Region B',
            "Region B's read replica has replication lag — the system is eventually consistent",
            "The user's auth token was not propagated to Region B in time",
            "Region B is running an older API version that doesn't support the new data format"
          ]
        },
        {
          q: 'Services: Auth → Cart → Payment → Order → Notification. A user is charged but receives no order confirmation. Payment logs show success. Where do you look first?',
          options: [
            'Auth service — the token may have expired between Payment and Order',
            'Cart service — the cart may not have been cleared, blocking the Order creation',
            'Order service — the Payment→Order handoff is where the chain broke based on the evidence',
            'Notification service — it likely failed to send the email after Order was created'
          ]
        }
      ],
      tasks: [
        {
          title: 'Trace a Failure Across 5 Services',
          scenario: 'Platform: Auth → Cart → Payment → Order → Notification\n\nUser report: "I was charged $89. My bank shows a pending transaction. My cart wasn\'t cleared. No confirmation email. My Orders page shows nothing."\n\nPayment service log: "payment_id=pay_xK2m COMPLETED $89.00 at 14:32:01"',
          question: 'Rank the services by suspicion (most likely failure point first) and explain your reasoning.\n\nWith no centralised tracing tool, how do you trace this across services using only per-service logs?\n\nWrite one E2E test case that would have caught this exact failure before it reached production.',
          placeholder: 'Service ranking: ...\nInvestigation approach: ...\nE2E test: ...',
          evalPrompt: 'You are a senior distributed systems engineer evaluating a failure trace analysis. The failure likely occurred between Payment and Order service (Order was not created despite successful payment), with Notification failing as a downstream consequence. Cart not clearing suggests the frontend listens for order confirmation. Score 0–10: correct identification of the failure point (3 pts), practical investigation approach using only per-service logs (2 pts), specific service-level queries (2 pts), E2E test case quality (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Test Strategy for a Monolith → Microservices Migration',
          scenario: 'A monolith handling auth, orders, payments, inventory, and notifications is being split into microservices over 3 months. During migration, both systems run simultaneously with traffic split via feature flags: 10% → 25% → 50% → 100%.',
          question: 'What are the 3 biggest testing risks during this parallel-run phase? For each: why is it a risk, how you detect it, and what test mitigates it.\n\nHow do you validate data consistency between monolith and microservices during the split?',
          placeholder: 'Risk 1: ...\nRisk 2: ...\nRisk 3: ...\nData consistency: ...',
          evalPrompt: 'You are a senior platform QA engineer evaluating a migration test strategy. Key risks: data consistency during dual-write, session/auth state portability, feature parity gaps, rollback safety at each cutover percentage, and performance regression under split traffic. Score 0–10: identification and quality of the 3 biggest risks (4 pts), detection and mitigation quality per risk (4 pts), data consistency validation strategy (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 7. AI IN QA ──────────────────────────────────────────── */
    {
      id: 7,
      domain: 'AI in QA',
      mcqs: [
        {
          q: 'You are testing an LLM-powered support chatbot that scores 96% accuracy on your test set. Which critical risk does this number NOT capture?',
          options: [
            'Whether the bot handles common questions correctly — 96% accuracy covers this',
            'Whether the bot can produce harmful, biased, or privacy-leaking responses on rare but real edge case inputs not in your test set',
            "Whether the bot's API latency meets the 2-second SLA — accuracy doesn't measure latency",
            "Whether the bot's integration with the ticketing system works end-to-end"
          ]
        },
        {
          q: 'What makes testing an LLM feature fundamentally different from testing traditional deterministic software?',
          options: [
            'LLMs are slower, so test suites take longer to run',
            'LLMs require a GPU to run, making local testing impractical',
            'LLMs are non-deterministic — the same input can produce different outputs, making exact-match assertions invalid and requiring semantic evaluation',
            'LLMs use REST APIs, which require different test tooling than library-based code'
          ]
        },
        {
          q: 'Which approach is most appropriate for evaluating whether a new LLM model version is better than the current one?',
          options: [
            'Run the same unit test suite and check that all existing tests still pass',
            'Measure API response latency — a faster model is a better model',
            'Evaluate against a human-labelled golden dataset and/or run an A/B test measuring a defined success metric like task completion rate',
            'Ask the model to evaluate its own outputs and report a self-assessed quality score'
          ]
        }
      ],
      tasks: [
        {
          title: 'Design a Test Plan for an AI Feature',
          scenario: "Your product is adding \"Smart Summary\": reads a user's last 50 support tickets, generates a 3-sentence summary shown to agents before they respond.\n\nPotential failures: wrong user's data shown to agent, summary contains hallucinated details, summary times out after 12s, crashes on users with 0 tickets.",
          question: 'Design a test plan covering:\n1. Functional cases (0 tickets, 1 ticket, 50 tickets, non-English tickets)\n2. Safety & privacy risks (PII leakage, hallucination, prompt injection)\n3. Performance SLA — what limits would you set?\n4. How do you evaluate summary quality at scale (you can\'t read 10,000 summaries manually)?',
          placeholder: 'Functional cases: ...\nSafety risks: ...\nPerformance SLA: ...\nQuality at scale: ...',
          evalPrompt: 'You are a senior AI QA engineer evaluating a test plan for an LLM-powered feature. Score 0–10: functional test case coverage including 0/1/50+ tickets and non-English tickets (2 pts), safety and privacy risk identification (PII leakage, hallucination, prompt injection, cross-user data) (3 pts), performance SLA definition (1 pt), automated quality evaluation strategy at scale (LLM-as-judge, human-labeled golden set, semantic similarity) (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'AI in Your QA Workflow — Real Experience',
          scenario: 'AI tools (Claude, ChatGPT, Copilot) are being used in QA workflows for writing test cases, generating test data, analysing logs, writing scripts, and reviewing PRs.',
          question: 'Answer honestly:\n\n1. How are you actually using AI in your QA work right now? Be specific: which tool, which task, which workflow.\n\n2. One concrete example where AI helped you — or failed you. What did it teach you?\n\n3. One specific scenario where AI should NOT replace a human QA engineer, and exactly why.',
          placeholder: '1. Current AI usage: ...\n2. Concrete example: ...\n3. Where AI should not replace humans: ...',
          evalPrompt: 'You are a senior QA practitioner evaluating a candidate\'s self-assessment of AI usage in QA. Score 0–10: specificity and credibility of current AI usage (3 pts) — vague answers score 0–1, specific workflow descriptions score 2–3; concrete example quality with real insight (3 pts); quality and specificity of where AI should NOT replace humans (3 pts) — "humans are needed for creativity" scores 1, specific scenarios like "exploratory testing for undefined behaviors" or "safety-critical system sign-off" score 3; overall honesty and self-awareness (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    }
  ];

  /* ─────────────────────────────────────────────────────────────
     ENCODED ANSWER KEY
     Formula: _K[di][mi] = answer XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     Decode:  answer      = _K[di][mi] XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     ───────────────────────────────────────────────────────────── */
  var _K = [
    [242,  6, 23],   /* domain 0: API Testing          */
    [ 19, 33, 53],   /* domain 1: Back-End Testing      */
    [ 48, 67, 82],   /* domain 2: DB Log Reading        */
    [ 81, 99,112],   /* domain 3: Test Automation       */
    [110,129,147],   /* domain 4: Root Cause Analysis   */
    [143,158,178],   /* domain 5: Complex Systems       */
    [172,188,205]    /* domain 6: AI in QA              */
  ];

  function _dec(di, mi) {
    return _K[di][mi] ^ (((di * 31 + mi * 17 + 0xF3) & 0xFF));
  }

  /* ─────────────────────────────────────────────────────────────
     INTEGRITY — FNV-1a 32-bit signature for sessionStorage
     Detects any direct sessionStorage manipulation on results page.
     ───────────────────────────────────────────────────────────── */
  function _sig(obj) {
    var str = JSON.stringify(obj) + '\u03a9qa\u03a9sk25';
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  }

  /* ─────────────────────────────────────────────────────────────
     ENGINE STATE — all private to this IIFE
     ───────────────────────────────────────────────────────────── */
  var TOTAL_SECS = 600;
  var CIRC       = 2 * Math.PI * 26;

  var _idx         = 0;
  var _deadline    = 0;
  var _timer       = null;
  var _watchdog    = null;   /* recursive timeout — survives clearInterval bruteforce */
  var _domainStart = 0;
  var _warnShown   = false;
  var _sel         = [];
  var _candidate   = null;
  var _responses   = {};
  var _timings     = {};
  var _done        = false;
  var _tampered    = false;  /* sessionStorage tampering detected on load             */
  var _tabSwitches = 0;      /* times candidate hid / left the tab                   */

  /* ── Boot ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('assessmentCard')) return;

    var raw = sessionStorage.getItem('qa_candidate');
    if (!raw) { window.location.href = 'index.html'; return; }

    _candidate  = JSON.parse(raw);
    _responses  = JSON.parse(sessionStorage.getItem('qa_responses') || '{}');
    _timings    = JSON.parse(sessionStorage.getItem('qa_timings')   || '{}');
    _idx        = parseInt(sessionStorage.getItem('qa_current_task') || '0', 10);

    /* ── Submitted-lock: prevent retaking after full submission ───
       Even if qa_current_task is manually reset to 0 in DevTools,
       the signed submitted flag redirects them back to thankyou.   */
    var _subFlag = sessionStorage.getItem('qa_submitted');
    var _subSig  = sessionStorage.getItem('qa_submitted_sig');
    if (_subFlag === '1' && _subSig === _sig({ s: 1, e: (_candidate && _candidate.email) || '' })) {
      window.location.href = 'thankyou.html';
      return;
    }

    /* ── Signature re-verification: detect sessionStorage tampering
       If qa_responses was edited between domains the stored signature
       won't match — mark as tampered so it's flagged in submission.  */
    var _prevSig = sessionStorage.getItem('qa_sig');
    if (_prevSig && Object.keys(_responses).length > 0) {
      var _expectedSig = _sig({ r: _responses, t: _timings, e: (_candidate && _candidate.email) || '' });
      if (_prevSig !== _expectedSig) _tampered = true;
    }

    /* ── Domain-lock: completed assessment cannot be re-entered ─── */
    if (_idx >= _D.length) {
      _done = true;
      window.location.href = 'thankyou.html';
      return;
    }

    document.getElementById('headerCandidate').textContent = _candidate.fullName || '';
    renderDomain(_idx);
  });

  /* Warn before leaving mid-assessment */
  window.addEventListener('beforeunload', function (e) {
    if (!_done) { e.preventDefault(); e.returnValue = ''; }
  });

  /* Track tab switches — signals candidate left to look up answers */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !_done) _tabSwitches++;
  });

  /* ── Render domain ─────────────────────────────────────────── */
  function renderDomain(idx) {
    var domain = _D[idx];
    _sel = new Array(domain.mcqs.length).fill(null);

    /* Progress */
    document.getElementById('progressFill').style.width   = ((idx / _D.length) * 100) + '%';
    document.getElementById('progressLabel').textContent  = 'Domain ' + (idx + 1) + ' of ' + _D.length;
    document.getElementById('progressDomain').textContent = domain.domain;

    /* Header */
    document.getElementById('domainBadge').textContent = domain.domain;
    document.getElementById('domainTitle').textContent = domain.domain;

    /* MCQs */
    var mcqEl = document.getElementById('mcqContainer');
    mcqEl.innerHTML = '';

    domain.mcqs.forEach(function (mcq, qi) {
      var block = document.createElement('div');
      block.className = 'mcq-block';

      var qnum = document.createElement('div');
      qnum.className   = 'mcq-qnum';
      qnum.textContent = 'Question ' + (qi + 1) + ' of ' + domain.mcqs.length;

      var qtxt = document.createElement('p');
      qtxt.className   = 'mcq-question';
      qtxt.textContent = mcq.q;

      var opts = document.createElement('div');
      opts.className = 'mcq-options';

      mcq.options.forEach(function (opt, oi) {
        var lbl = document.createElement('label');
        lbl.className = 'mcq-option';

        var radio   = document.createElement('input');
        radio.type  = 'radio';
        radio.name  = 'mcq_' + qi;
        radio.value = oi;

        var marker = document.createElement('span');
        marker.className   = 'mcq-marker';
        marker.textContent = String.fromCharCode(65 + oi);

        var span = document.createElement('span');
        span.textContent = opt;

        lbl.appendChild(radio);
        lbl.appendChild(marker);
        lbl.appendChild(span);
        opts.appendChild(lbl);

        lbl.addEventListener('click', (function (capturedQi, capturedOi, capturedOpts, capturedMarker) {
          return function () {
            _sel[capturedQi] = capturedOi;
            capturedOpts.querySelectorAll('.mcq-option').forEach(function (l) { l.classList.remove('selected'); });
            lbl.classList.add('selected');
            capturedMarker.style.background = 'var(--white)';
            capturedMarker.style.color = 'var(--text-inv)';
            capturedOpts.querySelectorAll('.mcq-option:not(.selected) .mcq-marker').forEach(function (m) {
              m.style.background = '';
              m.style.color = '';
            });
          };
        })(qi, oi, opts, marker));
      });

      block.appendChild(qnum);
      block.appendChild(qtxt);
      block.appendChild(opts);
      mcqEl.appendChild(block);
    });

    /* Tasks */
    var taskEl = document.getElementById('taskContainer');
    taskEl.innerHTML = '';

    domain.tasks.forEach(function (task, ti) {
      var block = document.createElement('div');
      block.className = 'task-block';

      block.innerHTML =
        '<div class="task-block-header">' +
          '<span class="task-block-num">Task ' + (ti + 1) + '</span>' +
          '<span class="task-block-title">' + esc(task.title) + '</span>' +
        '</div>' +
        '<div class="scenario-block">' + esc(task.scenario) + '</div>' +
        '<div class="task-question-label">Your Task</div>' +
        '<div class="task-question-text">' + esc(task.question) + '</div>' +
        '<span class="answer-label">Your Answer</span>' +
        '<textarea class="answer-textarea" id="task_' + ti + '" placeholder="' + esc(task.placeholder) + '"></textarea>' +
        '<div class="char-count" id="chars_' + ti + '">0 characters</div>';

      taskEl.appendChild(block);

      var ta = document.getElementById('task_' + ti);
      ta.addEventListener('input', (function (capturedTi) {
        return function () {
          document.getElementById('chars_' + capturedTi).textContent =
            ta.value.length.toLocaleString() + ' characters';
        };
      })(ti));
    });

    /* Submit button */
    document.getElementById('submitBtn').onclick = function () { submitDomain(false); };

    /* Auto-submit time label */
    var endTime = new Date(_now() + TOTAL_SECS * 1000);
    document.getElementById('autoSubmitAt').textContent =
      endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    startTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Timer ─────────────────────────────────────────────────────
     Wall-clock deadline — immune to secondsLeft manipulation.
     _now() is captured at IIFE init so Date.now spoofing from
     the console has no effect.
     Watchdog uses recursive setTimeout (not setInterval) so its
     ID changes every 3 s — brute-force clearInterval(1..9999)
     cannot reliably kill it.                                      */
  function startTimer() {
    clearInterval(_timer);
    clearTimeout(_watchdog);
    _warnShown   = false;
    _domainStart = _now();
    _deadline    = _now() + TOTAL_SECS * 1000;

    updateTimer(TOTAL_SECS);

    /* Display timer — updates the UI every 500 ms */
    _timer = setInterval(function () {
      var rem = Math.max(0, Math.round((_deadline - _now()) / 1000));
      updateTimer(rem);

      if (rem <= 120 && !_warnShown) {
        _warnShown = true;
        document.getElementById('autosubmitNotice').style.display = 'flex';
      }

      if (rem <= 0) {
        clearInterval(_timer);
        submitDomain(true);
      }
    }, 500);

    /* Watchdog — force-submits even if display timer is killed */
    (function watchdog() {
      _watchdog = setTimeout(function () {
        if (_done) return;
        var rem = Math.round((_deadline - _now()) / 1000);
        if (rem <= 0) { submitDomain(true); return; }
        watchdog(); /* reschedule — new ID each time */
      }, 3000);
    }());
  }

  function updateTimer(rem) {
    var m = Math.floor(rem / 60);
    var s = rem % 60;

    var el   = document.getElementById('timerDisplay');
    var ring = document.getElementById('timerRing');

    el.textContent = pad(m) + ':' + pad(s);

    var fraction = rem / TOTAL_SECS;
    ring.style.strokeDasharray  = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - fraction);

    el.classList.remove('warning', 'danger');
    ring.classList.remove('warning', 'danger');

    if (rem <= 30) {
      el.classList.add('danger');
      ring.classList.add('danger');
    } else if (rem <= 120) {
      el.classList.add('warning');
      ring.classList.add('warning');
    }
  }

  /* ── Submit ────────────────────────────────────────────────── */
  function submitDomain(isAuto) {
    clearInterval(_timer);
    clearTimeout(_watchdog);

    var domain   = _D[_idx];
    var timeUsed = Math.round((_now() - _domainStart) / 1000);

    var btn = document.getElementById('submitBtn');
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    if (isAuto) showFlash('Time\'s up — domain auto-submitted.');

    /* Grade MCQs using decoded answer key — never compares against source */
    var mcqResults = domain.mcqs.map(function (mcq, qi) {
      var sel     = _sel[qi];
      var correct = _dec(_idx, qi);
      return { selected: sel, isCorrect: sel === correct };
    });

    /* Collect task answers */
    var taskAnswers = domain.tasks.map(function (_, ti) {
      var el = document.getElementById('task_' + ti);
      return el ? el.value.trim() : '';
    });

    /* Speed-run flag — under 90 s for 3 MCQs + 2 tasks is suspicious */
    var suspicious = timeUsed < 90;

    var key = 'domain_' + domain.id;
    _responses[key] = {
      domainName:  domain.domain,
      mcqResults:  mcqResults,
      mcqScore:    mcqResults.filter(function (r) { return r.isCorrect; }).length,
      taskAnswers: taskAnswers,
      suspicious:  suspicious
    };
    _timings[key + '_secs'] = timeUsed;

    sessionStorage.setItem('qa_responses',    JSON.stringify(_responses));
    sessionStorage.setItem('qa_timings',      JSON.stringify(_timings));

    /* Sign the stored data — detects sessionStorage tampering on results page */
    var sigPayload = { r: _responses, t: _timings, e: (_candidate && _candidate.email) || '' };
    sessionStorage.setItem('qa_sig', _sig(sigPayload));

    /* Last domain → lock submission, send everything, redirect */
    if (_idx >= _D.length - 1) {
      _done = true;
      sessionStorage.setItem('qa_current_task', String(_D.length));

      /* Submitted-lock — tamper-evident flag prevents retaking
         even if qa_current_task is reset to 0 in DevTools      */
      sessionStorage.setItem('qa_submitted',     '1');
      sessionStorage.setItem('qa_submitted_sig',
        _sig({ s: 1, e: (_candidate && _candidate.email) || '' }));

      _submitAll().then(function () {
        window.location.href = 'thankyou.html';
      }).catch(function () {
        window.location.href = 'thankyou.html';
      });
      return;
    }

    _idx++;
    sessionStorage.setItem('qa_current_task', String(_idx));

    /* Fade transition */
    var card = document.getElementById('assessmentCard');
    card.style.transition = 'opacity 0.2s';
    card.style.opacity    = '0';

    setTimeout(function () {
      document.getElementById('autosubmitNotice').style.display = 'none';
      btn.disabled  = false;
      btn.innerHTML = 'Submit &amp; Next Domain →';
      card.style.opacity = '1';
      renderDomain(_idx);
    }, 250);
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;')
      .replace(/\n/g, '<br>');
  }

  function showFlash(msg) {
    var banner = document.createElement('div');
    banner.className = 'notice notice-danger';
    banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9999;max-width:400px;width:90%;';
    banner.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/></svg> <span>' + msg + '</span>';
    document.body.appendChild(banner);
    setTimeout(function () { banner.remove(); }, 3500);
  }

  /* ── Submit all responses to Google Sheets + AI eval ─────── */
  function _submitAll() {
    var flat = {
      timestamp:     new Date().toISOString(),
      fullName:      _candidate.fullName,
      email:         _candidate.email,
      experience:    _candidate.experience,
      role:          _candidate.role,
      domain:        _candidate.domain,
      linkedin:      _candidate.linkedin || '',
      totalMcqScore: 0,
      totalDomains:  _D.length,
      tampered:      _tampered,      /* sessionStorage edited between sessions */
      tabSwitches:   _tabSwitches    /* times candidate left/hid the tab       */
    };

    var totalMcq = 0;
    _D.forEach(function (d) {
      var key  = 'domain_' + d.id;
      var resp = _responses[key] || {};
      flat[key + '_mcq_score']   = resp.mcqScore    || 0;
      flat[key + '_mcq_answers'] = JSON.stringify(resp.mcqResults || []);
      flat[key + '_task_1']      = (resp.taskAnswers && resp.taskAnswers[0]) || '';
      flat[key + '_task_2']      = (resp.taskAnswers && resp.taskAnswers[1]) || '';
      flat[key + '_time_secs']   = _timings[key + '_secs'] || 0;
      flat[key + '_suspicious']  = !!(resp.suspicious);
      totalMcq += resp.mcqScore || 0;
    });
    flat.totalMcqScore = totalMcq;

    var sheetsP = Promise.resolve();
    if (SHEETS_ENDPOINT) {
      sheetsP = fetch(SHEETS_ENDPOINT, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(flat)
      }).catch(function (err) { console.error('Sheets submission failed:', err); });
    }

    var evalP = Promise.resolve();
    if (AI_EVAL_ENDPOINT) {
      var evalPayload = [];
      _D.forEach(function (d) {
        var key  = 'domain_' + d.id;
        var resp = _responses[key] || {};
        d.tasks.forEach(function (task, ti) {
          evalPayload.push({
            domain:     d.domain,
            taskTitle:  task.title,
            evalPrompt: task.evalPrompt || '',
            answer:     (resp.taskAnswers && resp.taskAnswers[ti]) || ''
          });
        });
      });

      evalP = fetch(AI_EVAL_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candidateEmail: _candidate.email, tasks: evalPayload })
      }).then(function (res) {
        if (res.ok) {
          return res.json().then(function (data) {
            sessionStorage.setItem('qa_ai_scores', JSON.stringify(data));
          });
        }
      }).catch(function (err) { console.error('AI evaluation failed:', err); });
    }

    return Promise.all([sheetsP, evalP]);
  }

  /* ── Expose domain list for thankyou.html (names only, no answers) */
  window.DOMAINS = _D;

})();
