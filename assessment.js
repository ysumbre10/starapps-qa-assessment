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
          q: 'POST /admin/api/2024-01/orders.json returns 201 with the new order object. Which additional check is essential to confirm the order was actually persisted?',
          options: [
            'Verify the response body contains a non-null id field',
            'Confirm the HTTP status code is 201 Created',
            'Send GET /admin/api/2024-01/orders/{id}.json and verify the order exists in the store',
            'Verify the response time is under 500 ms'
          ]
        },
        {
          q: 'The Shopify Admin REST API returns the header X-Shopify-Shop-Api-Call-Limit: 39/40. What does this mean?',
          options: [
            'You have 39 successful calls and 40 failed ones in the current window',
            'You have 39 calls remaining before hitting the rate limit',
            'You have used 39 of your 40 available calls — 1 call remains before throttling',
            'Your API key has a permanent daily limit of 40 calls'
          ]
        },
        {
          q: 'A Shopify webhook for orders/fulfilled consistently does not fire when you fulfil a test order. What is the most useful first step?',
          options: [
            'Check the Shopify Partners dashboard webhook logs for delivery failures and HTTP response codes',
            'Verify your endpoint\'s SSL certificate is valid and trusted',
            'Increase the webhook processing timeout on your server',
            'Re-register the webhook with a different event topic to reset the delivery state'
          ]
        },
        {
          q: 'You test DELETE /admin/api/2024-01/products/9999999.json with a product ID that does not exist. Shopify returns 404. A junior QA marks this as "FAIL — expected 200". What is the correct expected status code?',
          options: [
            '200 OK — delete operations always confirm success with 200',
            '204 No Content — the resource is already gone, so no content is returned',
            '404 Not Found — the resource does not exist, which is the correct and expected response',
            '422 Unprocessable Entity — the product ID format is invalid'
          ]
        },
        {
          q: '(Hard) You call POST /admin/api/2024-01/inventory_levels/adjust.json and receive 200 with the updated inventory level. Twenty seconds later, GET /admin/api/2024-01/inventory_levels.json?inventory_item_ids={id} returns the OLD value. No errors anywhere. What is the most likely explanation?',
          options: [
            'The POST response was served from cache and the adjustment never reached the Shopify server',
            'There is read replica lag — the GET is served from a replica that has not yet received the write',
            'Shopify queues inventory adjustments asynchronously and applies them within 5 minutes',
            'The GET request is using an API version that does not support real-time inventory reads'
          ]
        }
      ],
      tasks: [
        {
          title: 'Test Shopify Webhook Idempotency',
          scenario: 'Your app receives orders/paid webhooks from Shopify. Shopify guarantees at-least-once delivery — the same webhook can arrive more than once. A merchant reports duplicate order records in your database roughly 1 in 200 deliveries.',
          question: 'Write 3 test cases that verify your handler correctly prevents duplicate processing.\nFor each: input → expected response/behaviour → what bug it catches.',
          placeholder: 'TC-01: Input: ...\nExpected: ...\nBug caught: ...',
          evalPrompt: 'You are a senior QA engineer evaluating webhook idempotency test cases for a Shopify app. Score 0–10: idempotency key or unique constraint test (3 pts), duplicate webhook same payload test (3 pts), race condition or concurrent delivery scenario (2 pts), correctness of expected responses (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Debug a 422 on Shopify Order Creation',
          scenario: 'POST /admin/api/2024-01/orders.json returns 422 Unprocessable Entity. Your request body is valid JSON. The same payload works on your development store but fails on the merchant\'s live store.',
          question: 'List your 3 most likely causes.\nFor each: one API call or log check that confirms or rules it out.',
          placeholder: 'Cause 1: ...\nHow to confirm: ...\n\nCause 2: ...\nHow to confirm: ...',
          evalPrompt: 'You are a senior QA engineer evaluating API debugging for a Shopify 422 error. Expected causes: missing required fields (line_items/email), inventory not available at that location, invalid variant or product ID, billing address validation failure. Score 0–10: cause quality (5 pts), investigation method specificity (3 pts), overall reasoning (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 2. BACK-END TESTING ──────────────────────────────────── */
    {
      id: 2,
      domain: 'Back-End Testing',
      mcqs: [
        {
          q: 'A Shopify app background job processes order_paid webhooks and updates a database. 97 of every 100 orders are updated. No errors in logs, job exits with code 0. What is the most likely root cause?',
          options: [
            'The Shopify webhook is sending 3% of events to the wrong endpoint',
            'A try/catch block in the job is swallowing exceptions, allowing the job to skip those orders and continue',
            'The database is running out of connections and silently dropping 3% of writes',
            'Shopify rate limits are causing 3% of the order lookups to fail silently'
          ]
        },
        {
          q: 'Your Shopify app has 100% unit test line coverage but fails in the merchant\'s production store with incorrect discount totals. What is the most precise reason this can happen?',
          options: [
            'The unit tests do not cover decimal rounding edge cases for multi-currency orders',
            'Shopify\'s staging and production environments process discounts differently',
            '100% line coverage confirms every line executed — not that the business logic is correct for all real Shopify price and discount combinations',
            'The production app is using a different version of the Shopify API than the test environment'
          ]
        },
        {
          q: 'Which approach gives the highest confidence that a refactored Shopify discount engine produces identical results to the original?',
          options: [
            'Running the existing unit tests — they all pass',
            'Comparing outputs for the same inputs: original vs. refactored, across 100+ cart configurations with real Shopify discount combinations',
            'Verifying that code complexity has not changed — same cyclomatic complexity',
            'Deploying to a Shopify development store and manually testing 5 cart scenarios'
          ]
        },
        {
          q: 'A Shopify app test suite takes 45 minutes to run. The single highest-impact fix is:',
          options: [
            'Delete all tests that have ever failed intermittently',
            'Reduce the number of assertions per test to speed up each test',
            'Run tests that do not share state in parallel across multiple workers',
            'Replace all integration tests with unit tests'
          ]
        },
        {
          q: '(Hard) A Shopify app processes refund/create webhooks. Under load testing at 50 concurrent refunds, 2–3 requests fail with a database deadlock error. What is the actual root cause?',
          options: [
            'The database server cannot handle 50 concurrent connections at this tier',
            'Two transactions are acquiring locks on the same rows in opposite order',
            'Shopify is sending duplicate refund webhooks that conflict at the database level',
            'The connection pool is exhausted, causing requests to queue and time out'
          ]
        }
      ],
      tasks: [
        {
          title: 'Investigate Silent Order Sync Failure',
          scenario: 'A Shopify app syncs order_paid events to a warehouse system — ~500/hour. After deploying a discount calculation fix, only ~460/hour arrive at the warehouse. No errors in logs. Dead letter queue is empty.',
          question: 'List your 3 investigation steps in priority order.\nWrite 2 test cases that would catch this in CI before it reaches production.',
          placeholder: 'Step 1: ...\nStep 2: ...\nStep 3: ...\n\nTC-01: ...\nTC-02: ...',
          evalPrompt: 'You are a senior backend/QA engineer evaluating a silent data loss investigation for a Shopify webhook sync. Expected answers: check for silent exception swallowing in new code, filter/condition change excluding some orders, idempotency logic over-filtering, offset or pagination bug. Score 0–10: investigation step quality (5 pts), CI test case quality (4 pts), overall reasoning (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Spot the Regression in a Discount Refactor',
          scenario: 'Original code applies discounts sequentially on a Shopify cart:\n  1. Loyalty: 10% off subtotal\n  2. Bulk: 20% off if qty > 5\n\nNew code calculates both discount amounts from the original price simultaneously, then subtracts the sum. All unit tests pass.',
          question: 'Is the new code mathematically equivalent? Show with subtotal = $100, qty = 6.\nWrite 2 test cases with specific inputs and correct expected outputs for both approaches.',
          placeholder: 'Equivalent? ...\n\n$100 example:\n  Original: ...\n  New: ...\n\nTC-01: Input: $... → Original expected: $... → New expected: $...',
          evalPrompt: 'You are a senior QA engineer evaluating a pricing regression analysis. Correct answer: NOT equivalent. Original: $100×0.9=$90, $90×0.8=$72. New: $100-$10-$20=$70. Difference=$2. Score 0–10: correct identification of non-equivalence (3 pts), correct math for the $100 example (3 pts), test case quality with correct expected values for both approaches (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 3. DB LOG READING ────────────────────────────────────── */
    {
      id: 3,
      domain: 'DB Log Reading',
      mcqs: [
        {
          q: 'EXPLAIN ANALYZE on a Shopify orders query shows Seq Scan on a table where an index exists on the exact column in the WHERE clause. What is the most likely reason?',
          options: [
            'The index is corrupt and needs to be rebuilt with REINDEX',
            'SELECT * forces a full heap scan because it retrieves all columns from the table',
            'The query planner estimated a full table scan is cheaper because a large percentage of rows match the filter, making the index less selective',
            'The index was created but autovacuum has not yet run to register it with the planner'
          ]
        },
        {
          q: 'You see "deadlock detected" in production Postgres logs during Shopify order processing. What is the correct first action?',
          options: [
            'Increase deadlock_timeout from 1 s to 10 s to give transactions more time to resolve',
            'Restart the database to clear all in-flight transactions immediately',
            'Identify which queries and tables are involved in the deadlock from the log detail, then fix the lock acquisition order in application code',
            'Add a retry loop to the application so deadlocked transactions automatically recover'
          ]
        },
        {
          q: 'A Shopify app query runs in 15 ms in staging (500K orders) but 8,500 ms in production (15M orders). Both environments have the same index. What is the most likely root cause?',
          options: [
            'Staging runs a newer Postgres version with better query optimisation',
            'The query planner in production chose a sequential scan because at 15M rows the data distribution makes the index less selective than at 500K rows',
            'The production database is missing autovacuum, causing table bloat',
            'Production reads from a replica that does not have the index replicated from the primary'
          ]
        },
        {
          q: 'A production log shows: lock wait timeout exceeded for UPDATE shopify_orders SET status=\'fulfilled\'. What does this indicate?',
          options: [
            'The shopify_orders table has too many rows and the UPDATE timed out during the full scan',
            'A long-running transaction is holding a lock on that specific row, blocking the UPDATE from acquiring it',
            'The database does not support concurrent UPDATEs on the same table at this volume',
            'The connection pool has too many idle connections, starving the UPDATE of an available slot'
          ]
        },
        {
          q: '(Hard) A Shopify app runs this migration on a 20M-row orders table during business hours: ALTER TABLE orders ADD COLUMN notes TEXT NOT NULL DEFAULT \'none\'. It takes 47 minutes and causes full write downtime. What is the correct explanation?',
          options: [
            'Adding a TEXT column always requires rebuilding all data pages regardless of database version',
            'In older Postgres versions, adding NOT NULL with a non-trivial DEFAULT requires a full table rewrite to populate the default on all existing rows, holding an exclusive lock throughout',
            'The migration acquired a lock but removing NOT NULL would have allowed concurrent writes during the operation',
            'The DEFAULT value \'none\' is a reserved SQL keyword that caused the migration engine to retry the statement multiple times'
          ]
        }
      ],
      tasks: [
        {
          title: 'Diagnose a Shopify App Deadlock Sequence',
          scenario: "09:14:02 [WARN]  Slow query 3,891ms — SELECT * FROM shopify_orders WHERE shop_id=42 AND status='pending'\n09:14:05 [ERROR] deadlock detected — tables: shopify_orders, line_items\n09:14:05 [ERROR] Transaction rollback: order_sync_id=1847\n09:14:06 [INFO]  Retry 1/3 for order_sync_id=1847\n09:14:10 [ERROR] Max retries exhausted — order_sync_id=1847 set to FAILED",
          question: 'Walk through what happened step by step in plain English.\nWhat is the root cause? One specific fix for the developer.\nWrite 2 regression test cases.',
          placeholder: 'What happened: ...\nRoot cause: ...\nFix: ...\n\nTC-01: ...\nTC-02: ...',
          evalPrompt: 'You are a senior DB/QA engineer evaluating deadlock log analysis for a Shopify app. Correct interpretation: slow query (missing index on status column) held row locks, concurrent sync transaction caused deadlock, retry logic exhausted, order failed. Root cause: missing index causing full table scan with long-held locks. Score 0–10: correct event sequence (3 pts), correct root cause (3 pts), developer fix quality (2 pts), regression test cases (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Risk-Assess a Live Shopify Orders Migration',
          scenario: "Migration to run during business hours on a 30M-row table:\n\n  ALTER TABLE shopify_orders ADD COLUMN fulfillment_source VARCHAR(50) NOT NULL DEFAULT 'manual';\n  CREATE INDEX CONCURRENTLY idx_orders_source ON shopify_orders(fulfillment_source);",
          question: 'What are the top 2 risks of running this on a live table?\nWrite a 4-point pre-migration checklist.\nWhat is your rollback plan if something goes wrong?',
          placeholder: 'Risk 1: ...\nRisk 2: ...\n\nChecklist:\n1. ...\n2. ...\n3. ...\n4. ...\n\nRollback: ...',
          evalPrompt: 'You are a senior DBA/QA engineer evaluating a migration risk assessment. Key risks: NOT NULL+DEFAULT causes full table rewrite in Postgres < 11 (exclusive write lock), CREATE INDEX CONCURRENTLY avoids a write lock but still takes time and disk. Score 0–10: table rewrite risk identification (3 pts), disk space and replication lag awareness (2 pts), checklist quality (3 pts), rollback plan (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 4. TEST AUTOMATION ───────────────────────────────────── */
    {
      id: 4,
      domain: 'Test Automation',
      mcqs: [
        {
          q: 'A Playwright test for Shopify checkout fails in CI with "element not found" on the Place Order button that appears after an async API call. It passes 100% locally. What is the correct fix?',
          options: [
            'Add await page.waitForTimeout(3000) before clicking to give CI extra time',
            'Use await expect(page.getByTestId(\'place-order-btn\')).toBeVisible() — it retries automatically until the element appears or the timeout is reached',
            'Set timeout: 60000 globally in playwright.config.ts to allow for slower CI runners',
            'Wrap the click in a try/catch and retry up to 3 times with a 2-second sleep between attempts'
          ]
        },
        {
          q: 'Which selector would remain stable after a Shopify theme update that renames CSS classes, restructures the DOM, and rewrites button labels?',
          options: [
            'page.locator(\'.add-to-cart-btn\') — CSS class selector',
            'page.locator(\'//div[@class="product"]/button[1]\') — XPath positional selector',
            'page.getByTestId(\'add-to-cart\') — data-testid attribute that the dev team controls independently of styling',
            'page.locator(\'button:has-text("Add to cart")\') — text content selector'
          ]
        },
        {
          q: 'You have 30 flaky Playwright tests for a Shopify storefront. Before deleting any, what is the most valuable first action?',
          options: [
            'Delete them immediately — flaky tests erode confidence and waste CI time',
            'Mark all of them as skipped until you have time to investigate properly',
            'Run each flaky test 5 times and check whether the same test consistently fails or fails inconsistently across runs',
            'Add await page.waitForTimeout(2000) to each flaky test as a stopgap fix'
          ]
        },
        {
          q: 'A Shopify checkout E2E test passes in CI, but the team reports checkout is broken for mobile users. What is the most likely reason?',
          options: [
            'The test environment uses a different Shopify theme version than production',
            'The test runs on a desktop viewport only and never tested mobile breakpoints or touch interactions',
            'CI does not clear browser cookies between test runs, causing state leakage',
            'CI runs tests sequentially instead of in parallel, masking timing-related failures'
          ]
        },
        {
          q: '(Hard) A Shopify automation suite has 52 tests that broke when the "Submit" button text changed to "Confirm order". What is the root cause?',
          options: [
            'The tests use text-based selectors like page.getByText(\'Submit\') — brittle to any copy change',
            'The tests lack proper setup and teardown hooks, leaving shared state between runs',
            'Tests share mutable global state and rely on a specific execution order',
            'The CI pipeline does not pull the latest Shopify theme before running the suite'
          ]
        }
      ],
      tasks: [
        {
          title: 'Write a Playwright Test for Shopify Checkout',
          scenario: 'Shopify storefront checkout flow:\n  Step 1: Product page — [data-testid="add-to-cart"]\n  Step 2: Cart — [data-testid="checkout-btn"]\n  Step 3: Address — [data-testid="addr-email"], "addr-name", "addr-street"\n  Step 4: Payment — [data-testid="card-num"], "card-expiry", "card-cvv", "pay-btn"]\n  Step 5: Confirmation — [data-testid="order-number"]',
          question: 'Write a Playwright test for:\n(a) Happy path: product page to order confirmation — assert order number is visible\n(b) Declined card: assert user stays on the payment step with an error message visible',
          placeholder: 'test("checkout - happy path", async ({ page }) => {\n  ...\n});\n\ntest("checkout - declined card", async ({ page }) => {\n  ...\n});',
          evalPrompt: 'You are a senior SDET evaluating Playwright test code for a Shopify checkout flow. Score 0–10: correct async/await and Playwright syntax (2 pts), data-testid selectors used correctly (2 pts), happy path completeness with order number assertion (2 pts), declined card test quality and correct assertion (2 pts), overall code readability (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Diagnose a Brittle Shopify Automation Suite',
          scenario: 'Problems with the Shopify storefront test suite:\n  1. 30% of tests fail in CI but pass locally every time\n  2. Changing "Add to cart" to "Buy now" broke 40 tests\n  3. Running tests in alphabetical order changes results\n  4. Full suite takes 52 minutes, blocking every deployment',
          question: 'For each of the 4 problems: exact root cause + one specific, actionable fix.\nWhat test pyramid ratio (unit/integration/E2E) would you recommend and why?',
          placeholder: 'Problem 1 — Root cause: ... Fix: ...\nProblem 2 — Root cause: ... Fix: ...\nProblem 3 — Root cause: ... Fix: ...\nProblem 4 — Root cause: ... Fix: ...\n\nPyramid recommendation: ...',
          evalPrompt: 'You are a senior SDET evaluating automation troubleshooting advice for a Shopify storefront suite. Expected: CI flakiness → async waits / missing env setup; text selector brittleness → data-testid or role selectors; test order dependency → shared state / teardown / isolated test data; slow suite → parallelisation / test pyramid restructuring. Score 0–10: correct root cause per problem (4 pts), specific actionable fixes (4 pts), test pyramid recommendation quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 5. ROOT CAUSE ANALYSIS ───────────────────────────────── */
    {
      id: 5,
      domain: 'Root Cause Analysis',
      mcqs: [
        {
          q: 'A Shopify production bug cannot be reproduced in staging after 3 hours. Real users are still affected. What is your most valuable immediate action?',
          options: [
            'Close the ticket as "cannot reproduce" and increase alert thresholds to reduce noise until it recurs',
            'Roll back the last deployment immediately to remove the suspected change',
            'Add structured logging to the exact production code path and deploy to capture full context on the next occurrence',
            'Systematically compare all differences between staging and production — config values, data volume, feature flags'
          ]
        },
        {
          q: 'Which 5-Whys chain correctly reaches the systemic root cause for "Shopify orders stopped syncing to the ERP"?',
          options: [
            'Sync job crashed → server ran out of memory → root cause: add more RAM to the server',
            'Sync job crashed → API rate limit hit → root cause: implement better throttling on API calls',
            'API credentials expired → root cause: no automated alert on credential expiry and no rotation policy',
            'Sync job crashed → disk full → logs not rotated → no rotation policy → ops runbook missing log management → root cause: incomplete ops process documentation'
          ]
        },
        {
          q: 'A Shopify checkout bug occurs on iOS 16 Safari only — works on Android Chrome and iOS 15 Safari. What is the most targeted first investigation step?',
          options: [
            'Test on every device and browser combination in BrowserStack to map the full blast radius',
            'Check whether any CSS or JavaScript used in checkout is unsupported or behaves differently in Safari iOS 16 specifically',
            'Roll back the last Shopify theme update as the most likely cause',
            'Test with JavaScript disabled to isolate whether the issue is client-side or server-side'
          ]
        },
        {
          q: 'A Shopify store\'s cart page loads in 1.2 s on desktop but 8.4 s on mobile. Which is the most likely single root cause?',
          options: [
            'Mobile devices have slower CPUs and cannot parse JavaScript as quickly as desktop',
            'Mobile network latency is higher — 4G vs. Wi-Fi adds significant round-trip time',
            'Large, unoptimised images are being downloaded at full desktop resolution on mobile devices',
            'The Shopify CDN routes mobile traffic through geographically different edge nodes'
          ]
        },
        {
          q: '(Hard) A post-mortem reveals: config deployed without review → DB max_connections set to 2 → 89% payment errors for 47 minutes. Which is the most complete set of contributing factors?',
          options: [
            'No config review process + no config validation in CI + no staging test of the config change before production deployment',
            'The developer made a typo and the database connection limit was configured too low',
            'No automated tests for configuration values + PagerDuty alerts fired too slowly',
            'The deployment pipeline lacked a rollback mechanism for configuration-only changes'
          ]
        }
      ],
      tasks: [
        {
          title: 'RCA: Shopify Checkout Broken on iOS 16 Safari',
          scenario: 'Bug report: "Place Order button does nothing on iPhone 14 (iOS 16.4, Safari). No error shown to the customer. Works on: Chrome desktop, Firefox, Android Chrome, iOS 15 Safari. Broken on: all iOS 16 Safari devices tested (4 users confirmed)."',
          question: 'Apply 5-Whys to the technical root cause.\nApply 5-Whys separately to the PROCESS failure — why did QA not catch this before release?\nPropose 2 specific process changes to prevent this class of bug in future.',
          placeholder: 'Technical 5-Whys:\nWhy 1: ...\nWhy 2: ...\n\nProcess 5-Whys:\nWhy 1: ...\nWhy 2: ...\n\nProcess changes:\n1. ...\n2. ...',
          evalPrompt: 'You are a senior QA engineer evaluating a root cause analysis for a platform-specific Shopify checkout bug. Technical root cause: likely a CSS or JS change incompatible with Safari iOS 16 (passive event listeners, scroll behaviour, or a specific CSS property). Process failure: no cross-browser/cross-OS regression coverage for iOS Safari. Score 0–10: technical 5-Whys depth and specificity (3 pts), investigation approach (2 pts), process failure depth (3 pts), prevention recommendations quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Write a Post-Mortem for a Shopify App Outage',
          scenario: 'Timeline:\n  14:32 — Config change pushed to production (no review)\n  14:34 — Payment error rate: 0.1% → 89%\n  14:38 — PagerDuty alert fires\n  14:58 — Root cause found: DB max_connections set to 2 (was 200)\n  15:01 — Config reverted\n  15:19 — Full recovery\n\nImpact: 47 min degraded. ~1,200 failed Shopify orders. ~£38,000 estimated revenue impact.',
          question: 'Write a complete post-mortem: Summary, Timeline, Root Cause, Contributing Factors, Action Items (minimum 3, each with owner role and deadline).\n\nKeep it concise — this goes to the merchant and engineering leadership.',
          placeholder: 'Summary: ...\n\nTimeline: ...\n\nRoot Cause: ...\n\nContributing Factors: ...\n\nAction Items:\n1. [Owner] [Deadline] ...',
          evalPrompt: 'You are a senior engineering manager evaluating a post-mortem for a Shopify app outage. Score 0–10: clear factual summary (1 pt), accurate timeline (2 pts), root cause AND contributing factors — not just "bad config" but also: no review process, no CI config validation, no staging gate (3 pts), impact with numbers (1 pt), action item quality with owner role and deadline (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 6. COMPLEX SYSTEMS ───────────────────────────────────── */
    {
      id: 6,
      domain: 'Complex Systems',
      mcqs: [
        {
          q: 'Services: Shopify → Order App → Inventory App → ERP. The ERP degrades to p99 = 12 s. Which single pattern most directly prevents this from making Order App unresponsive?',
          options: [
            'Add retry with exponential backoff on Order App\'s calls to Inventory App — failed calls will eventually succeed once ERP recovers',
            'Implement a circuit breaker on Inventory App\'s calls to ERP — after N failures it opens and returns a cached fallback immediately instead of waiting 12 s',
            'Increase the HTTP timeout on Order App\'s calls to Inventory App from 10 s to 30 s to accommodate ERP degradation',
            'Add a health check endpoint on ERP that Inventory App polls every second before making any calls'
          ]
        },
        {
          q: 'A Shopify order appears in the Order service immediately after creation but is missing in the ERP for 10–15 seconds with no errors in any logs. Which explanation is most consistent with this evidence?',
          options: [
            'The ERP has an intermittent bug that drops write operations under load',
            'The order event is replicating asynchronously — this is expected eventual consistency behaviour; the write succeeded and propagation is in progress',
            'The Shopify webhook fired before the order was fully committed to the primary database',
            'The ERP API is throttling the Order service and silently dropping some inbound requests'
          ]
        },
        {
          q: 'What does "observability" specifically mean for a QA engineer testing a Shopify app with 5 microservices?',
          options: [
            'The ability to watch real-time CPU and memory dashboards for each service',
            'The ability to toggle feature flags to isolate each service\'s behaviour independently',
            'The ability to reconstruct exactly what happened in a production failure using only logs, metrics, and distributed traces — without needing to reproduce it',
            'The ability to run automated regression tests against each service in complete isolation from others'
          ]
        },
        {
          q: 'During a Shopify checkout, Stripe confirms payment but the order is never created in the Order service. The most likely failure point is:',
          options: [
            'The payment service timed out before returning the success status to the checkout frontend',
            'The event or message between the payment service and the order service was lost or never published',
            'The order service was completely down when the payment confirmation arrived',
            'The Shopify webhook fired before Stripe\'s payment confirmation was fully processed'
          ]
        },
        {
          q: '(Hard) A Shopify app\'s monolith is splitting into microservices. At 25% traffic cutover, some users see inconsistent order totals between the legacy and new systems. No errors in either. What is the root cause?',
          options: [
            'The 25% traffic split is random — some users hit both systems within the same session',
            'The two systems calculate discounts using different rounding rules or apply promotions in a different order',
            'The new microservice is not yet optimised for 25% production traffic load',
            'Session cookies are routing some users inconsistently between the two systems'
          ]
        }
      ],
      tasks: [
        {
          title: 'Trace a Payment-to-Order Failure Across Services',
          scenario: 'Stack: Shopify → Payment Service → Order Service → Notification Service\n\nMerchant report: "Customer was charged £89 via Stripe. Cart was not cleared. No confirmation email. Orders page shows nothing."\n\nPayment service log: "stripe_payment_id=pi_3xK2m COMPLETED £89.00 at 14:32:01"',
          question: 'Rank the services by most likely failure point and explain your reasoning.\nWithout a centralised tracing tool, how do you correlate this across per-service logs?\nWrite one E2E test case that would have caught this exact failure before production.',
          placeholder: 'Ranking:\n1. ... (reason)\n2. ...\n\nInvestigation approach: ...\n\nE2E test:\n  Input: ...\n  Steps: ...\n  Expected: ...',
          evalPrompt: 'You are a senior distributed systems engineer evaluating a failure trace analysis for a Shopify payment-to-order gap. The failure is between Payment and Order service (payment succeeded, order never created). Cart not clearing and no email are downstream consequences. Score 0–10: correct failure localisation between Payment→Order (3 pts), log correlation approach without centralised tracing (2 pts), per-service log query specificity (2 pts), E2E test case quality (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Test Strategy for a Shopify App Migration',
          scenario: 'A Shopify app monolith handling orders, payments, and inventory is splitting into 3 microservices over 6 weeks. Traffic is split via feature flags: 10% → 25% → 50% → 100%.',
          question: 'What are the 2 biggest testing risks during the parallel-run phase? For each: why it\'s a risk, how you detect it, what test mitigates it.\nHow do you validate data consistency between monolith and microservices at the 25% cutover?',
          placeholder: 'Risk 1: ...\n  Why: ...\n  Detection: ...\n  Mitigation: ...\n\nRisk 2: ...\n  Why: ...\n  Detection: ...\n  Mitigation: ...\n\nData consistency validation: ...',
          evalPrompt: 'You are a senior platform QA engineer evaluating a Shopify app migration test strategy. Key risks: data consistency during dual-write, business logic discrepancy (rounding/discount calculation differences), session/auth state portability, rollback safety at each cutover step. Score 0–10: risk identification quality (4 pts), detection and mitigation quality per risk (4 pts), data consistency validation strategy (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 7. AI IN QA ──────────────────────────────────────────── */
    {
      id: 7,
      domain: 'AI in QA',
      mcqs: [
        {
          q: 'An LLM-powered Shopify product description generator scores 94% accuracy on your test set. Which critical risk does this metric alone NOT address?',
          options: [
            'Whether the generator correctly uses the product title and category from the Shopify product data',
            'Whether the generator handles products with no existing description or very short titles',
            'Whether the generator produces harmful, hallucinated, or brand-unsafe outputs for edge-case products absent from your test set',
            'Whether the generator is fast enough for the Shopify admin UI response time expectation'
          ]
        },
        {
          q: 'What makes testing a Shopify AI product tagging feature fundamentally different from testing a traditional rule-based tagger?',
          options: [
            'AI inference is slow, making the test suite take significantly longer to complete',
            'AI requires cloud APIs, making fully local test infrastructure impractical',
            'The AI is non-deterministic — the same product input can produce different tags on different runs, making exact-match assertions unreliable',
            'AI models communicate via REST APIs which require different tooling than library-based code'
          ]
        },
        {
          q: 'A Shopify merchant reports the AI chatbot gave a customer incorrect return policy information. Which combination of tests would best catch this before production?',
          options: [
            'Unit tests for the API endpoint that calls the LLM',
            'A curated set of policy-related questions with expected answers, evaluated against the actual LLM outputs',
            'Load testing the chatbot with 1,000 concurrent users to expose race conditions',
            'Checking the chatbot\'s average response time against the 3-second SLA'
          ]
        },
        {
          q: 'Which is the most reliable way to evaluate whether a new LLM version outperforms the current one for Shopify customer support responses?',
          options: [
            'Ask the development team to read 100 sample responses and vote on which version is better',
            'Compare average response times — the faster model is better suited for production',
            'Use LLM-as-judge: a more capable model scores responses from both versions against curated reference answers with defined evaluation criteria',
            'Count how many responses are under 200 words — conciseness signals better comprehension'
          ]
        },
        {
          q: '(Hard) An AI feature auto-generates Shopify discount codes based on customer purchase history. In testing, 3 of 1,000 generated codes are valid codes belonging to other customers\' histories. Which risk does this represent and what is the correct test strategy?',
          options: [
            'Performance risk — the feature is slow for edge cases; add load tests to surface the bottleneck',
            'Privacy and data leakage risk — the AI is cross-contaminating user data; build an isolation test suite with synthetic per-user data and verify zero cross-user output for every generated code',
            'Accuracy risk — some generated codes are wrong; add more representative training data to reduce the error rate',
            'Security risk — discount codes are guessable by brute force; add rate limiting to the generation endpoint'
          ]
        }
      ],
      tasks: [
        {
          title: 'Test Plan for a Shopify AI Product Tagger',
          scenario: 'Your Shopify app uses an LLM to auto-tag products for the merchant\'s store. It reads the product title, description, and category, then generates 5 tags per product.\n\nPotential failures: wrong tags for niche products, tags from another merchant\'s store appearing, slow response on large descriptions, crashes on products with no description.',
          question: 'Design a test plan covering:\n1. Functional cases (no description, 1-word title, non-English product)\n2. Privacy risk (tags from another merchant\'s data leaking into this store)\n3. Performance: what SLA would you set for tag generation?\n4. How do you evaluate tag quality at scale without reading all outputs manually?',
          placeholder: 'Functional cases: ...\n\nPrivacy test: ...\n\nPerformance SLA: ...\n\nQuality at scale: ...',
          evalPrompt: 'You are a senior AI QA engineer evaluating a test plan for an LLM-powered Shopify product tagger. Score 0–10: functional case coverage including zero-description, short title, non-English product (2 pts), privacy/cross-merchant isolation test quality (3 pts), performance SLA definition (1 pt), scalable quality evaluation strategy such as LLM-as-judge, semantic similarity, or human-labelled golden set (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'AI in Your Shopify QA Workflow',
          scenario: 'AI tools (Claude, ChatGPT, Copilot) are being used in Shopify QA workflows for writing test cases, generating product and order test data, analysing Shopify API logs, and writing Playwright scripts.',
          question: 'Answer honestly:\n1. Which AI tool do you use and for what specific Shopify QA task?\n2. One concrete example where AI helped or misled you in a QA context. What did you learn?\n3. One specific Shopify QA scenario where AI should NOT replace a human QA engineer, and exactly why.',
          placeholder: '1. Tool and task: ...\n2. Concrete example: ...\n3. Should not replace humans for: ...',
          evalPrompt: 'You are a senior QA practitioner evaluating a candidate\'s self-assessment of AI usage in Shopify QA. Score 0–10: specificity of AI usage in a Shopify QA context (3 pts) — vague answers 0–1, specific workflow 2–3; concrete example with real insight (3 pts); specific Shopify scenario where AI should not replace humans such as exploratory testing, production incident triage, edge case discovery in real merchant data (3 pts); honesty and self-awareness (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    }
  ];

  /* ─────────────────────────────────────────────────────────────
     ENCODED ANSWER KEY  (single-answer, index-based)
     Formula: _K[di][mi] = answer_index XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     Decode:  answer_index = _K[di][mi] XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     Index: 0=A, 1=B, 2=C, 3=D
     ───────────────────────────────────────────────────────────── */
  var _K = [
    [241,  6, 21, 36, 54],   /* domain 0: API Testing           C,C,A,C,B */
    [ 19, 33, 53, 71, 87],   /* domain 1: Back-End Testing      B,C,B,C,B */
    [ 51, 64, 82,101,116],   /* domain 2: DB Log Reading        C,C,B,B,B */
    [ 81, 99,112,130,148],   /* domain 3: Test Automation       B,C,C,B,A */
    [109,131,144,160,179],   /* domain 4: Root Cause Analysis   C,D,B,C,A */
    [143,158,178,192,211],   /* domain 5: Complex Systems       B,B,C,B,B */
    [175,188,206,226,240]    /* domain 6: AI in QA              C,C,B,C,B */
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
    _sel = new Array(domain.mcqs.length).fill(-1);

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
        cb.type   = 'radio';
        cb.name   = 'mcq_' + qi;
        cb.value  = oi;

        var marker = document.createElement('span');
        marker.className   = 'mcq-marker';
        marker.textContent = String.fromCharCode(65 + oi);

        var span = document.createElement('span');
        span.textContent = opt;

        lbl.appendChild(cb);
        lbl.appendChild(marker);
        lbl.appendChild(span);
        opts.appendChild(lbl);

        cb.addEventListener('change', (function (capturedQi, capturedOi, capturedLbl, capturedOpts) {
          return function () {
            if (this.checked) {
              _sel[capturedQi] = capturedOi;
              capturedOpts.querySelectorAll('.mcq-option').forEach(function (l) {
                l.classList.remove('selected');
                var m = l.querySelector('.mcq-marker');
                if (m) { m.style.background = ''; m.style.color = ''; }
              });
              capturedLbl.classList.add('selected');
              var selMarker = capturedLbl.querySelector('.mcq-marker');
              if (selMarker) {
                selMarker.style.background = 'var(--white)';
                selMarker.style.color = 'var(--text-inv)';
              }
            }
          };
        })(qi, oi, lbl, opts));
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

    /* Grade MCQs — _dec returns the correct answer index (0=A,1=B,2=C,3=D).
       _sel[qi] is the index the candidate selected (-1 = no answer).        */
    var mcqResults = domain.mcqs.map(function (mcq, qi) {
      var selIdx  = _sel[qi];
      var corrIdx = _dec(_idx, qi);
      return { selectedIdx: selIdx, correctIdx: corrIdx, isCorrect: selIdx === corrIdx };
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
