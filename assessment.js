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
          q: 'You send POST /api/orders with a valid body and receive 200 OK with the new order in the response body. What is the problem?',
          options: [
            '200 OK is acceptable — it signals success and the created resource is in the body',
            '201 Created should be returned — it semantically signals a new resource was created',
            '204 No Content is correct — the server should not return a body on creation',
            '202 Accepted is correct — order creation is typically processed asynchronously',
            'All of the above'
          ]
        },
        {
          q: 'Which of the following are valid test cases specifically targeting idempotency key behaviour on POST /api/payments?',
          options: [
            'Send the same request twice with the same idempotency key and verify the second call returns the original response without a duplicate charge',
            'Send two requests with different idempotency keys and verify both create separate payment records',
            'Send the same request with the same idempotency key after the documented key-expiry period and verify the API behaviour matches its spec',
            'Send two different amounts with the same idempotency key and expect both to succeed',
            'All of the above'
          ]
        },
        {
          q: "GET /api/users/{id}/orders is called with User A's valid JWT but User B's {id}. The API returns 200 OK with User B's orders. Which vulnerability does this expose?",
          options: [
            "Broken Authentication — User A's token should have been rejected by the auth middleware",
            'Mass Assignment — the API is accepting and processing parameters it should not expose',
            'Insecure Direct Object Reference (IDOR) — authorisation is not enforced at the resource level',
            "Privilege Escalation — User A has been granted elevated access by the server",
            'All of the above'
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
          q: 'A background job exits with code 0 but only 49,203 of 50,000 records are updated. No errors in logs. Which of the following would you investigate first?',
          options: [
            'The server ran out of memory mid-execution and records were silently dropped',
            'A try/catch block is swallowing exceptions, allowing the job to skip records and continue',
            'A WHERE clause or filter condition is silently excluding some records from the update',
            'The database auto-rolled back some transactions due to a unique constraint violation',
            'All of the above'
          ]
        },
        {
          q: 'A service has 100% unit test line coverage but fails in staging with incorrect output. What is the most precise reason this can happen?',
          options: [
            'The unit tests contain bugs that mirror the same logic errors in production code',
            'Staging uses different environment variables that the code does not handle correctly',
            '100% line coverage confirms every line was executed — not that the logic is correct or that interactions between components work as expected',
            'The CI pipeline ran tests in a different order than staging executes them',
            'All of the above'
          ]
        },
        {
          q: 'Which two testing approaches provide the highest confidence that a refactored payment service behaves identically to the original?',
          options: [
            'Integration tests that run the service against real dependencies — real database, real message queue, real downstream services',
            'Smoke tests that verify the service starts and returns 200 on the health endpoint',
            'Contract tests that verify the API request/response schema has not changed for all consuming services',
            'Static analysis confirming the refactored code has the same cyclomatic complexity as before',
            'All of the above'
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
          q: 'EXPLAIN ANALYZE shows: Seq Scan on a table where an index exists on the exact column in the WHERE clause. What is the most likely explanation?',
          options: [
            'The index is corrupt and needs to be rebuilt with REINDEX',
            'The query planner estimated that a full table scan is cheaper than the index scan given the current filter selectivity and data distribution',
            'The developer forgot to commit the CREATE INDEX migration to production',
            'SELECT * prevents index usage because it forces retrieval of all columns from the heap',
            'All of the above'
          ]
        },
        {
          q: 'You see "deadlock detected" errors in production logs every few minutes during peak hours. Which two actions address the root cause?',
          options: [
            'Restart the database service immediately to clear all in-flight locks',
            'Identify which tables and rows are involved in the deadlock using pg_locks or SHOW ENGINE INNODB STATUS',
            'Review application code transaction ordering — two transactions acquiring locks in opposite order cause deadlocks',
            'Increase deadlock_timeout from 1s to 10s to give transactions more time to resolve before failing',
            'All of the above'
          ]
        },
        {
          q: 'A query runs in 8ms in staging (Index Scan, 500K rows) but 6,200ms in production (Seq Scan, 18M rows). The index exists in both environments. What is the most likely cause?',
          options: [
            'The staging statistics are actually stale — production\'s planner is making the correct decision for that data volume',
            'The query planner chose a sequential scan because the index is not selective enough for the data distribution at 18M rows — ANALYZE may update the plan',
            'Production is querying a read replica that does not have the index replicated from the primary',
            'The index type in production is Hash, which is incompatible with the range operator used in the WHERE clause',
            'All of the above'
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
          q: 'Your Playwright test fails in CI with "element not found" on a button that appears after an async API call. The test passes 100% locally. What is the correct fix?',
          options: [
            'Add await page.waitForTimeout(5000) before the click to give CI sufficient time to load',
            'Use await expect(page.getByTestId(\'submit-btn\')).toBeVisible() — it retries automatically until the element appears or the timeout is reached',
            'Set a global timeout: 60000 in playwright.config.ts to allow extra time on slow CI runners',
            'Wrap the interaction in a try/catch and retry the click 3 times with a 2s sleep between attempts',
            'All of the above'
          ]
        },
        {
          q: 'Which two selector strategies would remain stable after a UI redesign that renames CSS classes, restructures the DOM, and rewrites button labels?',
          options: [
            'page.locator(\'.checkout-btn\') — CSS class selector',
            'page.getByTestId(\'checkout-btn\') — data-testid attribute that the dev team controls independently of styling',
            'page.getByRole(\'button\', { name: /confirm/i }) — ARIA role with a regex accessible name that tolerates minor label changes',
            'page.locator(\'//div[@class="container"]/div[2]/button[1]\') — XPath positional selector',
            'All of the above'
          ]
        },
        {
          q: 'Your suite has 40 flaky tests. Which of the following are valid root causes of test flakiness worth fully investigating before deleting any test?',
          options: [
            'Race conditions — the test does not properly wait for async state before asserting',
            'Test interdependency — tests share mutable state or rely on a specific execution order',
            'Environment inconsistency — the test behaves differently between local machines and CI infrastructure',
            'Timing assumptions — hardcoded sleeps that fail when the system is under load or slower than expected',
            'All of the above'
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
          q: 'A production bug cannot be reproduced in staging after 4 hours of investigation. Real users are still affected. What are your best immediate next two actions?',
          options: [
            'Close the ticket as "cannot reproduce" and increase alert thresholds to reduce noise until it recurs',
            'Add structured logging to the exact production code path and deploy to capture full context on the next occurrence',
            'Systematically compare all environment differences — config values, data volume, feature flags, infrastructure — between staging and production',
            'Roll back the last 5 deployments to identify which change introduced the regression',
            'All of the above'
          ]
        },
        {
          q: 'Which of these correctly and completely applies 5-Whys to: "The payment service was down for 45 minutes"?',
          options: [
            'Why → server crashed. Root cause: bad server. Fix: replace it.',
            'Why → server crashed → Why → disk full → Why → logs not rotated → Why → no log rotation policy → Why → ops runbook does not include log rotation setup. Root cause: missing ops process.',
            'Why → server crashed → Why → too much traffic. Root cause: need auto-scaling. Fix: add more instances.',
            'Why → server crashed → Why → bad deployment. Root cause: need better code review. Fix: add mandatory approvals.',
            'All of the above'
          ]
        },
        {
          q: 'A race condition occurs 1 in every 500 test runs. Which approach would most reliably surface it in CI without just hoping it appears?',
          options: [
            'Add Thread.sleep(500) between the two racing operations to widen the timing window for observation',
            'Run the test 500 times sequentially in CI and fail the build if any single run fails',
            'Use thread sanitizers, stress testing tools, or artificial concurrency injection to amplify the timing window — then audit the code for missing synchronisation primitives',
            'Mark the test as xfail (expected failure) and document the race condition as a known issue for later',
            'All of the above'
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
          q: 'Services: A → B → C. Service C degrades to p99 = 9s. Which single pattern most directly prevents this latency from making Service A completely unresponsive?',
          options: [
            "Add retry with exponential backoff on Service A's calls to Service B — failed calls will eventually succeed once C recovers",
            "Implement a circuit breaker on Service B's calls to Service C — after N consecutive failures it opens and B immediately returns a cached fallback without waiting",
            "Increase Service A's HTTP timeout on calls to Service B from 10s to 30s to accommodate C's degraded latency",
            'Add a health check endpoint on Service C that Service B polls every second before making any calls',
            'All of the above'
          ]
        },
        {
          q: "A user's order appears in Region A immediately after creation but is missing in Region B for 8–12 seconds with no errors in any logs. Which two explanations are consistent with this evidence?",
          options: [
            "Region B's API has a bug that intermittently drops write operations under load",
            'The system is eventually consistent — the write was accepted in Region A and is still replicating to Region B',
            "The request was processed in Region A and returned before cross-region replication completed — a read-your-writes violation when reading from Region B",
            "Region B's CDN is serving a stale cached API response that has not yet expired",
            'All of the above'
          ]
        },
        {
          q: 'What does "observability" mean in the context of distributed system testing, and why does it matter specifically for QA?',
          options: [
            'The ability to monitor CPU and memory dashboards for each service in real time',
            'The ability to understand a system\'s internal state purely from its external outputs — logs, metrics, and distributed traces — so that a production failure can be reconstructed without needing to reproduce it',
            'The ability to run automated regression suites against each service in complete isolation from other services',
            'The ability to toggle features on and off via feature flags without redeployment',
            'All of the above'
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
          q: 'An LLM-powered support chatbot scores 96% accuracy on your test set. Which critical risks does this metric alone NOT address?',
          options: [
            'Whether the bot correctly handles the most frequent support queries — the 96% covers this',
            'Whether the bot can produce harmful, privacy-leaking, or adversarially-triggered outputs on edge cases absent from your test set',
            'Whether the bot\'s outputs are consistent — the same input may produce different responses on different invocations',
            'Whether the bot\'s API latency meets the product\'s 2-second SLA',
            'All of the above'
          ]
        },
        {
          q: 'What makes testing an LLM-powered feature fundamentally different from testing traditional deterministic software?',
          options: [
            'LLM inference is slow, making test suites take significantly longer to run',
            'LLMs require cloud APIs, making local testing infrastructure impractical',
            'LLMs are non-deterministic — the same input can produce different outputs across runs, making exact-match assertions invalid and requiring semantic or probabilistic evaluation',
            'LLMs communicate via REST APIs, which require different test tooling than library-based code',
            'All of the above'
          ]
        },
        {
          q: 'Which of the following are reliable approaches for evaluating whether a new LLM model version outperforms the current production model?',
          options: [
            'Evaluate against a human-labelled golden dataset with defined success metrics such as precision, recall, or task completion rate',
            'Use LLM-as-judge — a more capable model scores the outputs of the system under test against reference answers',
            'Run an A/B test with real users, measuring a defined behavioural metric such as issue resolution rate or satisfaction score',
            'Score outputs using semantic similarity embeddings between generated responses and curated reference answers',
            'All of the above'
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
  /* Bitmask encoding: bit0=A, bit1=B, bit2=C, bit3=D, bit4=E(all)
     Single answer B=2, C=4, A+C=5, B+C=6, All-of-above(E)=16        */
  var _K = [
    [241,  1, 17],   /* domain 0: API Testing           B(2), A+C(5), C(4)      */
    [ 20, 39, 49],   /* domain 1: Back-End Testing      B+C(6), C(4), A+C(5)    */
    [ 51, 68, 81],   /* domain 2: DB Log Reading        B(2), B+C(6), B(2)      */
    [ 82,103, 98],   /* domain 3: Test Automation       B(2), B+C(6), E/all(16) */
    [105,130,149],   /* domain 4: Root Cause Analysis   B+C(6), B(2), C(4)      */
    [140,153,178],   /* domain 5: Complex Systems       B(2), B+C(6), B(2)      */
    [171,186,223]    /* domain 6: AI in QA              B+C(6), C(4), E/all(16) */
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
    _sel = new Array(domain.mcqs.length).fill(0);

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

        var cb    = document.createElement('input');
        cb.type   = 'checkbox';
        cb.name   = 'mcq_' + qi;
        cb.value  = oi;

        var marker = document.createElement('span');
        marker.className   = 'mcq-marker';
        marker.textContent = String.fromCharCode(65 + oi);

        var span = document.createElement('span');
        span.textContent = opt;

        /* Visually distinguish the "All of the above" option (always index 4) */
        if (oi === 4) { lbl.style.borderTop = '1px solid var(--border-md)'; }

        lbl.appendChild(cb);
        lbl.appendChild(marker);
        lbl.appendChild(span);
        opts.appendChild(lbl);

        cb.addEventListener('change', (function (capturedQi, capturedOi, capturedLbl, capturedMarker) {
          return function () {
            if (this.checked) {
              _sel[capturedQi] = (_sel[capturedQi] || 0) | (1 << capturedOi);
              capturedLbl.classList.add('selected');
              capturedMarker.style.background = 'var(--white)';
              capturedMarker.style.color = 'var(--text-inv)';
            } else {
              _sel[capturedQi] = (_sel[capturedQi] || 0) & ~(1 << capturedOi);
              capturedLbl.classList.remove('selected');
              capturedMarker.style.background = '';
              capturedMarker.style.color = '';
            }
          };
        })(qi, oi, lbl, marker));
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

    /* Grade MCQs — _dec returns the correct-answer bitmask; _sel[qi] is the
       candidate's selected bitmask. Exact match required for full marks.    */
    var mcqResults = domain.mcqs.map(function (mcq, qi) {
      var selMask  = _sel[qi] || 0;
      var corrMask = _dec(_idx, qi);
      return { selectedMask: selMask, correctMask: corrMask, isCorrect: selMask === corrMask };
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
