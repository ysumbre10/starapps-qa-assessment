/* =============================================================
   QA Skill Check - Assessment Engine + Questions (v5)
   Security measures:
     1. IIFE - zero global vars; console cannot touch timer/answers
     2. Wall-clock deadline timer - decrement trick disabled
     3. XOR-encoded answer key - correct answers hidden from source
     4. FNV-1a signed sessionStorage - tampering detected on results page
     5. Minimum-time flag - speed-runs marked suspicious
     6. Domain-lock guard - completed domains cannot be re-entered
   ============================================================= */

(function () {
  'use strict';

  /* ── Config - loaded from config.js (gitignored) ──────────── */
  var _cfg             = (typeof window !== 'undefined' && window.QA_CONFIG) || {};
  var SHEETS_ENDPOINT  = _cfg.sheetsEndpoint  || '';
  var AI_EVAL_ENDPOINT = _cfg.aiEvalEndpoint  || '';
  var QA_TOKEN         = _cfg.qaToken         || '';

  /* ── Freeze timing primitives before any user code can spoof them */
  var _Date = Date;
  var _now  = _Date.now.bind(_Date);

  /* ─────────────────────────────────────────────────────────────
     QUESTIONS - correct answers stored encoded in _K below.
     ───────────────────────────────────────────────────────────── */
  var _D = [

    /* ── 0. MANUAL TESTING ────────────────────────────────────── */
    {
      id: 0,
      domain: 'Manual Testing',
      mcqs: [
        {
          q: 'Which statement best describes the difference between verification and validation?',
          options: [
            'Verification is performed by developers; validation is performed by QA engineers',
            'Verification confirms the product is built according to its specification; validation confirms it meets the user\'s actual need',
            'Verification happens after release; validation happens before release',
            'Verification tests performance; validation tests functionality',
            'All of the above'
          ]
        },
        {
          q: 'A 5-minute smoke test passes on every new build before it reaches QA. What does this confirm?',
          options: [
            'All features in the build work correctly without defects',
            'The build is stable enough for the team to begin detailed testing',
            'No regression has occurred since the last release',
            'The build is ready for deployment to production',
            'All of the above'
          ]
        },
        {
          q: 'A developer says "I can\'t reproduce this." Which addition to your bug report would be most useful?',
          options: [
            'Raising the bug\'s priority so the team takes it more seriously',
            'Re-testing three more times before escalating',
            'Adding exact steps to reproduce, the environment and browser used, expected vs actual result, and a screen recording',
            'Requesting the developer reproduce it on your machine with you present',
            'All of the above'
          ]
        },
        {
          q: 'A numeric input field accepts values from 1 to 100. Using equivalence partitioning, which set of test values gives minimum but complete class coverage?',
          options: [
            '1, 50, 100 - the lower bound, a middle value, and the upper bound',
            '0, 50, 101 - one value below the valid range, one valid value, one above the valid range',
            '1, 2, 99, 100 - both boundaries plus their adjacent values',
            '50 - a single representative value covers the valid partition',
            'All of the above'
          ]
        },
        {
          q: 'A developer fixes a bug in the checkout discount calculation. Which testing activity confirms the fix did not break anything else?',
          options: [
            'Retesting - run the specific test case that originally found the bug',
            'Regression testing - run the broader test suite to check for unintended side effects',
            'Exploratory testing - freely navigate the app to find anything unexpected',
            'Acceptance testing - confirm the fix satisfies the business requirement',
            'All of the above'
          ]
        },
        {
          q: 'You have 200 test cases, 2 hours, and the release proceeds regardless. How do you select which 40 to run?',
          options: [
            'Run the 40 most recently written test cases - they cover the newest functionality',
            'Run 40 randomly selected test cases to avoid bias',
            'Prioritise test cases covering high-business-risk areas, code changed in this release, and critical user journeys - run these first',
            'Run the 40 shortest test cases to maximise the number of checks within the time limit',
            'All of the above'
          ]
        },
        {
          q: 'A bug is classified as Severity 1 (application crash) but Priority 3 (fix in a future sprint). Which scenario makes this valid?',
          options: [
            'It is never valid - a Severity 1 bug must always be Priority 1',
            'The crash occurs only on a browser used by less than 0.1% of users, and fixing it now would delay a more critical deadline',
            'The developer responsible is unavailable, so priority is automatically reduced',
            'Severity and priority are the same attribute - this classification is a contradiction',
            'All of the above'
          ]
        }
      ],
      tasks: []
    },

    /* ── 1. API TESTING ───────────────────────────────────────── */
    {
      id: 1,
      domain: 'API Testing',
      mcqs: [
        {
          q: 'POST /api/orders returns 201 with the new order object. Which additional check is essential to confirm the order was actually saved?',
          options: [
            'Verify the response body contains a non-null id field',
            'Confirm the HTTP status code is 201 Created',
            'Send GET /api/orders/{id} and verify the record exists in the system',
            'Verify the response time is under 500 ms',
            'All of the above'
          ]
        },
        {
          q: 'An API response includes the header X-Rate-Limit-Used: 39/40. What does this mean?',
          options: [
            'You have 39 successful calls and 40 failed ones in the current window',
            'You have 39 calls remaining before hitting the rate limit',
            'You have used 39 of your 40 available calls -1 call remains before throttling',
            'Your API key has a permanent daily limit of 40 calls',
            'All of the above'
          ]
        },
        {
          q: 'A webhook for order completion consistently fails to fire during testing. What is the most useful first step?',
          options: [
            'Check the webhook delivery logs in the developer dashboard for error codes and HTTP responses',
            'Verify your endpoint\'s SSL certificate is valid and trusted',
            'Increase the webhook processing timeout on your server',
            'Re-register the webhook with a different event to reset its delivery state',
            'All of the above'
          ]
        },
        {
          q: 'You test DELETE /api/products/9999 where that product does not exist. The API returns 404. A junior QA marks this "FAIL - expected 200". What is the correct expected status?',
          options: [
            '200 OK - delete operations always return a success code',
            '204 No Content - the resource is already gone, no content needed',
            '404 Not Found - the resource does not exist, which is the correct and expected response',
            '422 Unprocessable Entity - the product ID format is invalid',
            'All of the above'
          ]
        },
        {
          q: 'You call POST /api/inventory/adjust and receive 200 with the updated value. Twenty seconds later, GET /api/inventory/{id} returns the old value. No errors anywhere. What is the most likely explanation?',
          options: [
            'The POST response was served from cache and the adjustment never reached the server',
            'There is read replica lag - the GET is served from a replica that has not yet received the write',
            'The platform queues inventory adjustments asynchronously and applies them within 5 minutes',
            'The GET request is targeting an API version that does not support real-time reads',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Design API Tests Without Code',
          scenario: 'You have been handed a REST API for creating customer orders. It has 5 required fields: customer_email, product_id, quantity, shipping_address, payment_token. You have not seen the code or the database.',
          question: 'Without writing a single line of code, list 6 things you would test. For each, write what you\'re testing and what you expect to happen.\nInclude at least one negative case, one boundary case, and one security-related check.',
          placeholder: '1. What I\'m testing: ... Expected: ...\n2. ...\n3. ...\n4. ...\n5. ...\n6. ...',
          evalPrompt: 'You are a senior QA engineer evaluating test design for a REST API without code access. Score 0–10: includes at least one negative or error case (2 pts), includes at least one boundary case such as empty fields or extreme values (2 pts), includes at least one security check such as injection or missing auth (2 pts), overall creative thinking and coverage quality (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Investigate a Silent API Failure',
          scenario: 'Your app\'s order creation API returns 200 OK every time. However, support is receiving complaints from customers saying their orders never appeared in the system. The logs show successful responses for the affected orders.',
          question: 'What are your 3 most likely explanations for this?\nFor each: what one check or log query would confirm or rule it out?',
          placeholder: 'Cause 1: ...\nCheck: ...\n\nCause 2: ...\nCheck: ...\n\nCause 3: ...\nCheck: ...',
          evalPrompt: 'You are a senior QA engineer evaluating API debugging for a silent failure where 200 is returned but data is not persisted. Score 0–10: evaluate the quality and plausibility of each of the 3 proposed causes — are they realistic explanations for a silent persistence failure? (5 pts); investigate method specificity — does each check actually confirm or rule out the stated cause? (3 pts); overall reasoning and clarity (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 2. BACK-END TESTING ──────────────────────────────────── */
    {
      id: 2,
      domain: 'Back-End Testing',
      mcqs: [
        {
          q: 'A background job processes order events and updates a database. 97 of every 100 orders are updated. No errors in logs, the job exits with code 0. What is the most likely root cause?',
          options: [
            'The event source is sending 3% of events to the wrong endpoint',
            'A try/catch block is swallowing exceptions, allowing the job to skip those records and continue silently',
            'The database is running out of connections and silently dropping 3% of writes',
            'Rate limits on an upstream service are causing 3% of lookups to fail without throwing an error',
            'All of the above'
          ]
        },
        {
          q: 'Your app has 100% unit test line coverage but fails in production with incorrect discount totals. What is the most precise reason this can happen?',
          options: [
            'The unit tests do not cover decimal rounding edge cases across different currencies',
            'The staging and production environments process discounts differently',
            '100% line coverage confirms every line was executed - not that the business logic is correct for all real price and discount combinations',
            'The production app is using a different dependency version than the test environment',
            'All of the above'
          ]
        },
        {
          q: 'Which approach gives the highest confidence that a refactored discount engine produces identical results to the original?',
          options: [
            'Running the existing unit tests - they all pass',
            'Comparing outputs for the same inputs: original vs refactored, across 100+ scenarios with varied discount combinations',
            'Verifying that code complexity has not changed - same cyclomatic complexity score',
            'Deploying to a staging environment and manually testing 5 discount scenarios',
            'All of the above'
          ]
        },
        {
          q: 'A test suite takes 45 minutes to run. The single highest-impact fix is:',
          options: [
            'Delete all tests that have ever failed intermittently',
            'Reduce the number of assertions per test to speed up each test',
            'Run tests that do not share state in parallel across multiple workers',
            'Replace all integration tests with unit tests',
            'All of the above'
          ]
        },
        {
          q: 'Under load testing at 50 concurrent requests, 2–3 requests fail with a database deadlock error. What is the actual root cause?',
          options: [
            'The database server cannot handle 50 concurrent connections at this tier',
            'Two transactions are acquiring locks on the same rows in opposite order, causing them to block each other indefinitely',
            'The event source is sending duplicate events that conflict at the database level',
            'The connection pool is exhausted, causing requests to queue and time out',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Spot the Bug in a Coverage Report',
          scenario: 'A developer says: "Our test coverage is 95% and all tests pass. This module is safe to ship."\n\nThe module calculates a final cart price:\n  1. Apply member discount (10% off)\n  2. Apply bulk discount (20% off if quantity > 5)\n  3. Round to 2 decimal places',
          question: 'Do you agree the module is safe to ship based on this evidence alone? Explain why or why not.\nWrite 2 test cases the current suite might be missing. For each: input → expected output.',
          placeholder: 'Agree or disagree and why: ...\n\nTC-01: Input: ... → Expected: ...\nTC-02: Input: ... → Expected: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a test coverage analysis response. Score 0–10: correctly challenges whether the coverage claim is sufficient evidence of correctness (3 pts), reasoning quality — does the candidate articulate why coverage alone is not enough? (3 pts); test case quality — are the two suggested test cases meaningful, with specific inputs and expected outputs that probe real risk areas in the module? (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'The Discount That Changed',
          scenario: 'Original logic:\n  1. Apply 10% loyalty discount first\n  2. Apply 20% bulk discount (qty > 5) on the result\n\nNew logic (refactored):\n  Calculate both discounts from the original price, then subtract the sum.\n\nAll existing unit tests pass after the refactor.',
          question: 'Are the two approaches mathematically identical? Show your working with a £100 subtotal, qty = 6.\nExplain in one sentence what the bug is and why the tests missed it.',
          placeholder: 'Same or different? ...\n\nOriginal: £100 → ...\nNew: £100 → ...\n\nBug: ...\nWhy tests missed it: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a pricing logic analysis. Score 0–10: correct identification of whether the two discount approaches are mathematically equivalent — award full marks only for the correct conclusion with clear reasoning (3 pts); working shown for the £100, qty=6 example using both approaches — does the math follow through correctly? (3 pts); clear explanation of what the discrepancy is and why it arises (2 pts); plausible explanation of why the existing tests failed to catch it (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 3. DB LOG READING ────────────────────────────────────── */
    {
      id: 3,
      domain: 'DB Log Reading',
      mcqs: [
        {
          q: 'A feature works correctly in testing but users report it is very slow in production. You find a "slow query" warning in the database logs. What is the most useful first step?',
          options: [
            'Mark the test as passed since the feature still works without throwing an error',
            'Log a bug report with the slow query details, response time, and affected feature, and share it with the developer',
            'Increase the test timeout so the warning no longer appears',
            'Rerun the test several times to see if it gets faster on its own',
            'All of the above'
          ]
        },
        {
          q: 'You see "deadlock detected" repeated in production database logs after a new feature release. As a QA engineer, what is the most useful first action?',
          options: [
            'Increase the server timeout setting so the error stops appearing in logs',
            'Note the error, identify which feature or user action triggers it, and raise a bug report with reproduction steps for the developer',
            'Restart the database server to clear the stuck transactions',
            'Ignore it since the system appears to have recovered on its own',
            'All of the above'
          ]
        },
        {
          q: 'A feature works perfectly in your test environment with 100 records, but times out for users in production with 500,000 records. What is the most likely explanation?',
          options: [
            'The test environment uses a different browser than production users',
            'The database is scanning every row to find matching records — fast with 100 rows but very slow at scale, likely due to a missing index',
            'The production server has a newer OS version that handles memory differently',
            'The feature was not tested on a mobile device',
            'All of the above'
          ]
        },
        {
          q: 'A production log shows: "ERROR: lock wait timeout exceeded". In plain terms, what does this mean?',
          options: [
            'The database disk is full and no more data can be written',
            'One database operation is waiting for another to finish before it can access the same data, and it waited too long',
            'The database password has expired and the connection was rejected',
            'The query contains a syntax error and could not be understood by the database',
            'All of the above'
          ]
        },
        {
          q: 'A developer plans to make a structural change to a live production database table that has millions of rows, during peak business hours. What concern should a QA engineer raise?',
          options: [
            'Database changes only affect new data and will never impact existing users',
            'Structural changes on large live tables can cause temporary slowness or errors for users while the change is being applied',
            'This is only a concern if the change affects the login page',
            'Database migrations always complete instantly regardless of table size',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Read This Log and Tell a Story',
          scenario: '08:44:01 [INFO]  Job started: sync_orders\n08:44:03 [WARN]  Slow query 2,200ms - SELECT * FROM orders WHERE status=\'pending\'\n08:44:06 [ERROR] deadlock detected - tables: orders, line_items\n08:44:06 [ERROR] Transaction rolled back: sync_id=4421\n08:44:07 [INFO]  Retry 1/3 for sync_id=4421\n08:44:11 [ERROR] Max retries exhausted - sync_id=4421 → FAILED',
          question: 'In plain English, describe what happened step by step.\nWhat do you think went wrong?\nWhat information would you include in a bug report for the developer?',
          placeholder: 'What happened:\n...\n\nWhat went wrong:\n...\n\nBug report details:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating a log reading response. Score 0–10: narrative accuracy — does the candidate correctly read and sequence the log lines, describing the slow query, error, rollback, retry, and final failure in a coherent story? (4 pts); problem identification — does the candidate reasonably identify what went wrong based on what the log shows, without requiring deep DBA knowledge? (3 pts); bug report quality — does the candidate include useful details such as error messages, timing, affected feature, and steps to reproduce? (3 pts). Reward clear thinking and good QA communication. Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Review a Risky Database Change',
          scenario: 'A developer says they need to make a database change on the live production system during business hours. The change adds a new required field to the orders table, which currently has 2 million rows. They plan to apply it directly to production without a maintenance window and without testing it first.',
          question: 'What concerns would you raise before this change goes ahead?\nWhat questions would you ask the developer or team lead before approving it?\nHow would you suggest doing this more safely?',
          placeholder: 'Concerns:\n...\n\nQuestions to ask:\n...\n\nSafer approach:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating a database change review response. Score 0–10: concern quality — does the candidate raise valid QA concerns such as user impact, risk of downtime, lack of testing, or no rollback plan? (4 pts); questions asked — are the questions sensible and focused on understanding the risk and impact before approving the change? (3 pts); safer approach — does the candidate suggest reasonable precautions such as testing in staging first, scheduling outside peak hours, or having a rollback plan? (3 pts). Reward practical QA thinking over deep database expertise. Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 4. TEST AUTOMATION ───────────────────────────────────── */
    {
      id: 4,
      domain: 'Test Automation',
      mcqs: [
        {
          q: 'A Playwright test fails in CI with "element not found" on a button that appears after an async API call. It passes 100% locally. What is the correct fix?',
          options: [
            'Add await page.waitForTimeout(3000) before the click to give CI extra time',
            'Use await expect(page.getByTestId(\'submit-btn\')).toBeVisible() - it retries automatically until the element appears or the timeout is reached',
            'Set timeout: 60000 globally in playwright.config.ts to accommodate slower CI runners',
            'Wrap the click in a try/catch and retry up to 3 times with a 2-second sleep between attempts',
            'All of the above'
          ]
        },
        {
          q: 'Which selector would remain stable after an application update that renames CSS classes, restructures the DOM, and changes button text?',
          options: [
            'page.locator(\'.add-to-cart-btn\') - a CSS class selector',
            'page.locator(\'//div[@class="product"]/button[1]\') - an XPath positional selector',
            'page.getByTestId(\'add-to-cart\') - a data-testid attribute controlled independently of styling',
            'page.locator(\'button:has-text("Add to cart")\') - a text content selector',
            'All of the above'
          ]
        },
        {
          q: 'You have 30 flaky automated tests. Before deleting any, what is the most valuable first action?',
          options: [
            'Delete them immediately - flaky tests erode confidence and waste CI time',
            'Mark all of them as skipped until you have time to investigate',
            'Run each flaky test 5 times and categorise whether each one fails consistently or inconsistently across runs',
            'Add await page.waitForTimeout(2000) to each flaky test as a stopgap fix',
            'All of the above'
          ]
        },
        {
          q: 'A checkout E2E test passes in CI, but users report checkout is broken on mobile. What is the most likely reason?',
          options: [
            'The test environment uses a different app version than production',
            'The test runs on a desktop viewport only and never tested mobile breakpoints or touch interactions',
            'CI does not clear browser cookies between test runs, causing state leakage',
            'CI runs tests sequentially instead of in parallel, masking timing-related failures',
            'All of the above'
          ]
        },
        {
          q: '52 automated tests broke when the "Submit" button text changed to "Confirm order". What is the root cause?',
          options: [
            'The tests use text-based selectors like page.getByText(\'Submit\') - brittle to any copy change',
            'The tests lack proper setup and teardown hooks, leaving shared state between runs',
            'Tests share mutable global state and rely on a specific execution order',
            'The CI pipeline does not pull the latest app build before running the suite',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Write Your First Playwright Test',
          scenario: 'You need to automate a login flow:\n  Page: /login\n  Elements: [data-testid="email-input"], [data-testid="password-input"], [data-testid="login-btn"]\n  Success: User lands on /dashboard\n  Failure: Error message at [data-testid="error-msg"]',
          question: 'Write a Playwright test for:\n(a) Successful login - assert the user reaches /dashboard\n(b) Wrong password - assert the error message is visible',
          placeholder: 'test(\'login - success\', async ({ page }) => {\n  ...\n});\n\ntest(\'login - wrong password\', async ({ page }) => {\n  ...\n});',
          evalPrompt: 'You are a senior SDET evaluating basic Playwright test code for a login flow. Score 0–10: correct async/await and Playwright syntax (2 pts), data-testid selectors used correctly (2 pts), successful login test with URL or element assertion (3 pts), wrong password test with error message assertion (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Fix These Broken Test Habits',
          scenario: 'A colleague\'s test file has three problems:\n  1. Tests fail in CI 30% of the time but always pass locally\n  2. Test B depends on data created by Test A - if A is skipped, B fails\n  3. Every test uses page.waitForTimeout(3000) to "wait for things to load"',
          question: 'For each of the 3 problems: explain the root cause in one sentence and suggest one specific fix.',
          placeholder: 'Problem 1 - Cause: ... Fix: ...\nProblem 2 - Cause: ... Fix: ...\nProblem 3 - Cause: ... Fix: ...',
          evalPrompt: 'You are a senior SDET evaluating automation anti-pattern analysis. Score 0–10: correct root cause identification for each of the 3 problems — are the explanations technically accurate and specific to the symptoms described? (4 pts); fix quality — is each suggested fix concrete, actionable, and appropriate to the root cause? (4 pts); overall clarity and precision of the response (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 5. ROOT CAUSE ANALYSIS ───────────────────────────────── */
    {
      id: 5,
      domain: 'Root Cause Analysis',
      mcqs: [
        {
          q: 'A production bug cannot be reproduced in staging after 3 hours. Real users are still affected. What is your most valuable immediate action?',
          options: [
            'Close the ticket as "cannot reproduce" and raise alert thresholds to reduce noise until it recurs',
            'Roll back the last deployment immediately to remove the suspected change',
            'Add structured logging to the exact production code path and deploy to capture full context on the next occurrence',
            'Systematically compare all differences between staging and production: config values, data volume, and feature flags',
            'All of the above'
          ]
        },
        {
          q: 'Which 5-Whys chain correctly reaches the systemic root cause for "orders stopped syncing to the warehouse"?',
          options: [
            'Sync job crashed → server ran out of memory → root cause: add more RAM to the server',
            'Sync job crashed → API rate limit hit → root cause: implement better throttling on API calls',
            'API credentials expired → no automated alert on credential expiry → no rotation policy → root cause: no credential lifecycle management process',
            'Sync job crashed → disk full → logs not rotated → no rotation policy → ops runbook missing → root cause: incomplete documentation',
            'All of the above'
          ]
        },
        {
          q: 'A checkout bug occurs on iOS 16 Safari only - works on Android Chrome and iOS 15 Safari. What is the most targeted first investigation step?',
          options: [
            'Test every device and browser combination in a cloud testing tool to map the full blast radius',
            'Check whether any CSS or JavaScript used in checkout behaves differently or is unsupported in Safari iOS 16 specifically',
            'Roll back the last frontend release as the most likely cause',
            'Test with JavaScript disabled to isolate whether the issue is client-side or server-side',
            'All of the above'
          ]
        },
        {
          q: 'A page loads in 1.2 s on desktop but 8.4 s on mobile. Which is the most likely single root cause?',
          options: [
            'Mobile devices have slower CPUs and cannot parse JavaScript as fast as desktop',
            'Mobile network latency is higher -4G vs. Wi-Fi adds significant round-trip time',
            'Large unoptimised images are being downloaded at full desktop resolution on mobile devices',
            'The CDN routes mobile traffic through geographically different edge nodes',
            'All of the above'
          ]
        },
        {
          q: 'A post-mortem reveals: a config change was pushed without review → the database connection limit was set to 2 → 89% of payment requests failed for 47 minutes. Which is the most complete set of contributing factors?',
          options: [
            'No config review process + no config validation in CI + no staging test of the config change before production deployment',
            'The developer made a typo and the connection limit was configured too low',
            'No automated tests for configuration values + alerting fired too slowly',
            'The deployment pipeline lacked a rollback mechanism for configuration-only changes',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Apply 5-Whys to a Real Bug',
          scenario: 'Bug report: "Users on iPhone (iOS 16, Safari) cannot complete checkout - the Place Order button does nothing. Works on all other browsers and on iOS 15."',
          question: 'Apply 5-Whys to find the technical root cause.\nThen apply 5-Whys separately to find the PROCESS root cause - why didn\'t QA catch this before release?\nEach chain should reach at least 3 Whys deep.',
          placeholder: 'Technical 5-Whys:\nWhy 1: ...\nWhy 2: ...\nWhy 3: ...\n\nProcess 5-Whys:\nWhy 1: ...\nWhy 2: ...\nWhy 3: ...',
          evalPrompt: 'You are a senior QA engineer evaluating 5-Whys analysis for a browser-specific bug. Score 0–10: technical 5-Whys depth and plausibility — does the chain reach at least 3 levels deep, with each Why logically following from the last and converging on a technically plausible root cause specific to this browser/OS combination? (4 pts); process 5-Whys — does the chain reach a systemic process or coverage gap rather than stopping at "it was not tested"? (4 pts); overall clarity and specificity of both chains (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Write a Mini Post-Mortem',
          scenario: 'Timeline:\n  14:32 - Config change deployed without review\n  14:34 - Payment errors jump from 0.1% to 89%\n  14:38 - Alert fires\n  14:58 - Root cause found: DB max_connections = 2 (was 200)\n  15:01 - Config reverted\n  15:19 - Full recovery\n\nImpact: 47 minutes, ~1,200 failed orders, ~£38,000 estimated revenue lost.',
          question: 'Write a short post-mortem covering:\n1. What happened (2–3 sentences)\n2. The root cause (go deeper than "someone made a typo")\n3. Three action items to prevent it recurring - each with a responsible role and a suggested deadline',
          placeholder: 'What happened: ...\n\nRoot cause: ...\n\nAction items:\n1. [Owner] [Deadline] ...\n2. [Owner] [Deadline] ...\n3. [Owner] [Deadline] ...',
          evalPrompt: 'You are a senior engineering manager evaluating a post-mortem write-up. Score 0–10: clear factual summary of what happened (2 pts), root cause that goes beyond the typo to include the process failure such as no review process and no CI config validation (3 pts), three action items that are specific and preventative with owner role and deadline (5 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 6. COMPLEX SYSTEMS ───────────────────────────────────── */
    {
      id: 6,
      domain: 'Complex Systems',
      mcqs: [
        {
          q: 'Your app calls a third-party payment service that has degraded to 12-second response times. Which single pattern most directly prevents your app from becoming unresponsive?',
          options: [
            'Add retry with exponential backoff - failed calls will eventually succeed once the service recovers',
            'Implement a circuit breaker - after a set number of failures it stops calling the service and returns a fallback immediately instead of waiting 12 s',
            'Increase the HTTP timeout from 10 s to 30 s to accommodate the degraded service',
            'Add a health-check endpoint to the payment service that your app polls every second before making any calls',
            'All of the above'
          ]
        },
        {
          q: 'An order appears in the Orders service immediately after creation but is missing in the warehouse system for 10–15 seconds, with no errors in any logs. Which explanation is most consistent with this evidence?',
          options: [
            'The warehouse system has an intermittent bug that drops write operations under load',
            'The order event is propagating asynchronously - this is expected eventual consistency behaviour; the write succeeded and the data is in transit',
            'The webhook fired before the order was fully committed to the primary database',
            'The warehouse API is throttling the Orders service and silently dropping some inbound requests',
            'All of the above'
          ]
        },
        {
          q: 'What does "observability" specifically mean when testing a backend app with several microservices?',
          options: [
            'The ability to monitor real-time CPU and memory dashboards for each service',
            'The ability to toggle feature flags to isolate each service\'s behaviour independently',
            'The ability to reconstruct exactly what happened during a production failure using only logs, metrics, and distributed traces - without needing to reproduce it',
            'The ability to run automated regression tests against each service in complete isolation',
            'All of the above'
          ]
        },
        {
          q: 'A user is charged by the payment provider, but no order appears in the Order service. The most likely failure point is:',
          options: [
            'The payment service timed out before returning the success status to the frontend',
            'The message or event between the payment service and the order service was lost or never published',
            'The order service was completely down when the payment confirmation arrived',
            'The payment webhook fired before the provider fully processed the transaction',
            'All of the above'
          ]
        },
        {
          q: 'During a gradual traffic migration from a monolith to microservices, some users see inconsistent totals between the two systems. No errors anywhere. What is the most likely root cause?',
          options: [
            'The traffic split is random - some users are hitting both systems within the same session',
            'The two systems calculate discounts using different rounding rules or apply promotions in a different order',
            'The new microservice is not yet optimised for its share of production traffic',
            'Session cookies are routing some users inconsistently between the two systems',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Trace a Broken Payment Flow',
          scenario: 'A user reports: "I was charged but my order never appeared. My cart is still full."\n\nYour stack: Frontend → Payment Service → Order Service → Email Service\n\nPayment service log: "payment_id=pi_abc123 COMPLETED £49.00 at 10:14:22"',
          question: 'Which service do you investigate first, and why?\nWhat is your step-by-step plan to trace where the flow broke, using only per-service logs?\nWrite one test scenario that would catch this type of failure before it reaches a real user.',
          placeholder: 'First service and why: ...\n\nInvestigation steps:\n1. ...\n2. ...\n3. ...\n\nTest scenario:\n  Input: ...\n  Steps: ...\n  Expected: ...',
          evalPrompt: 'You are a senior distributed systems engineer evaluating a failure analysis for a payment-to-order gap. Score 0–10: does the candidate correctly identify which service or boundary to investigate first based on the available log evidence, with a clear and logical justification? (3 pts); is the investigation plan structured, log-based, and does it follow the event chain through each service in a systematic way? (3 pts); does the proposed test scenario meaningfully cover this type of inter-service failure and would it reliably catch it before reaching a real user? (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'What Could Go Wrong?',
          scenario: 'Your company is splitting one large backend service into two smaller services over 4 weeks. Traffic will migrate gradually: 10% → 25% → 50% → 100%.\n\nDuring the parallel-run phase, both old and new services handle requests simultaneously.',
          question: 'Name 2 things that could go wrong during the parallel-run phase.\nFor each: explain why it is a risk and how you would detect it during testing.',
          placeholder: 'Risk 1: ...\n  Why it\'s a risk: ...\n  How to detect it: ...\n\nRisk 2: ...\n  Why it\'s a risk: ...\n  How to detect it: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a migration risk analysis for a parallel-run traffic split. Score 0–10: relevance and accuracy of Risk 1 — is it a genuine and specific risk arising from the parallel-run architecture described? (3 pts); relevance and accuracy of Risk 2 — same criteria, and is it meaningfully different from Risk 1? (3 pts); detection approach quality — for each risk, is the detection method concrete, testable, and likely to surface the problem before full cutover? (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 7. AI IN QA ──────────────────────────────────────────────────
       NOTE: domain 8 (QA Playground) appended after this block.
       ─────────────────────────────────────────────────────────────── */
    {
      id: 7,
      domain: 'AI in QA',
      mcqs: [
        {
          q: 'An AI-powered product description generator scores 94% accuracy on your test set. Which critical risk does this metric alone NOT address?',
          options: [
            'Whether the generator correctly uses the product title and category as input',
            'Whether the generator handles products with very short titles or no existing description',
            'Whether the generator produces harmful, misleading, or brand-unsafe content for products not in your test set',
            'Whether the generator is fast enough for the expected UI response time',
            'All of the above'
          ]
        },
        {
          q: 'What makes testing an AI tagging feature fundamentally different from testing a traditional rule-based tagger?',
          options: [
            'AI inference is slow, making the test suite significantly longer to run',
            'AI requires cloud APIs, making fully local test infrastructure impractical',
            'AI is non-deterministic - the same input can produce different outputs on different runs, making exact-match assertions unreliable',
            'AI models communicate via REST APIs, which require different tooling than library-based code',
            'All of the above'
          ]
        },
        {
          q: 'A chatbot gave a customer incorrect information about the return policy. Which test approach would best catch this before production?',
          options: [
            'Unit tests for the API endpoint that calls the LLM',
            'A curated set of policy-related questions with expected correct answers, evaluated against actual LLM outputs',
            'Load testing the chatbot with 1,000 concurrent users to expose race conditions',
            'Checking the chatbot\'s average response time against a defined SLA',
            'All of the above'
          ]
        },
        {
          q: 'Which is the most reliable way to evaluate whether a new AI model version outperforms the current one for customer support responses?',
          options: [
            'Ask the development team to read 100 sample responses and vote on which version is better',
            'Compare average response times - the faster model is better suited for production',
            'Use LLM-as-judge: a more capable model scores responses from both versions against curated reference answers with defined evaluation criteria',
            'Count how many responses are under 200 words - conciseness signals better comprehension',
            'All of the above'
          ]
        },
        {
          q: 'An AI feature generates personalised discount codes based on a user\'s purchase history. In testing, 3 out of 1,000 generated codes contain purchase data from a different user\'s history. Which risk does this represent?',
          options: [
            'Performance risk - the feature is slow for edge cases; add load tests to find the bottleneck',
            'Privacy and data leakage risk - the AI is cross-contaminating user data; build an isolation test with synthetic per-user data and verify zero cross-user output',
            'Accuracy risk - some generated codes are slightly wrong; add more representative training data',
            'Security risk - discount codes are guessable by brute force; add rate limiting to the endpoint',
            'All of the above'
          ]
        }
      ],
      tasks: [
        {
          title: 'Design a Test Plan for an AI Feature',
          scenario: 'Your team built a feature that automatically generates 3 product tags for any product, based on its title and description.\n\nPotential failures:\n- Wrong tags for unusual or niche products\n- Tags from another user\'s products appearing\n- Empty response when the description is very short or missing\n- Slow response on large product catalogues',
          question: 'Design a short test plan covering:\n1. Two functional test cases (include one edge case - e.g. a product with no description)\n2. One test for the privacy risk (another user\'s tags appearing in results)\n3. How would you evaluate tag quality at scale without reading every output manually?',
          placeholder: 'Functional TC-01: ...\nFunctional TC-02 (edge case): ...\n\nPrivacy test: ...\n\nQuality at scale: ...',
          evalPrompt: 'You are a senior AI QA engineer evaluating a test plan for an LLM-powered product tagger. Score 0–10: functional test cases including a meaningful edge case such as empty or very short description (3 pts), privacy or cross-user isolation test quality (3 pts), scalable quality evaluation approach such as LLM-as-judge, semantic similarity scoring, or a human-labelled golden set (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'You and AI Tools',
          scenario: 'AI tools are widely used in QA workflows for writing test cases, generating test data, reviewing code, and analysing logs.',
          question: 'Answer honestly:\n1. Which AI tool do you use (or have you tried) in your QA work? For what specific task?\n2. Give one concrete example where AI helped you - or misled you. What did you learn?\n3. Name one QA task where you believe AI should NOT replace a human, and explain exactly why.',
          placeholder: '1. Tool and task: ...\n2. Example: ...\n3. AI should not replace humans for: ...',
          evalPrompt: 'You are a senior QA practitioner evaluating a candidate\'s self-assessment of AI usage in QA. Score 0–10: specificity of AI usage in a real QA task - vague answers score 0–1, a specific workflow scores 2–3 (3 pts); concrete example with genuine insight gained (3 pts); specific QA scenario where AI should not replace humans with a clear reason such as exploratory testing, production incident triage, or edge case discovery in real data (3 pts); honesty and self-awareness (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    },

    /* ── 8. QA PLAYGROUND ──────────────────────────────────────── */
    {
      id: 8,
      domain: 'QA Playground',
      playground: true,   /* signals split-screen renderer */
      timerSecs: 1800,    /* 30 minutes */
      mcqs: [
        {
          q: 'You find "Smart Watch Pro" labeled "Out of Stock" on the Products page. What happens when you click its "Add to Cart" button?',
          options: [
            'The button is greyed out and unclickable',
            'A toast says "Item currently unavailable"',
            'The item is added to your cart successfully',
            'A modal appears asking you to join a waitlist',
            'The page shows an error: "Cannot add out-of-stock items"'
          ]
        },
        {
          q: 'You type "qatester" (no @ symbol, no domain) into the Email field of the Contact form and click "Send Message." What happens?',
          options: [
            'A red border appears with "Invalid email address"',
            'The form submits and shows a success confirmation',
            'The Send button stays disabled until a valid email is entered',
            'A browser tooltip says "Please include an @ in the email address"',
            'Nothing happens - the form silently fails'
          ]
        },
        {
          q: 'You apply discount code "SAVE15." The API Monitor shows: {"success": true, "discount": 0.15}. What does the cart total show after applying?',
          options: [
            'The total is reduced by 15%',
            'The total is reduced by a flat $15.00',
            'An error: "Invalid discount code"',
            'A "Discount Applied! Save 15%" badge appears but the cart total is unchanged',
            'The page refreshes and shows the new discounted total'
          ]
        },
        {
          q: 'You select "Price: Low to High." The four product prices are $49.99, $129.99, $29.99, and $12.99. What order appears?',
          options: [
            '$12.99, $29.99, $49.99, $129.99',
            '$12.99, $129.99, $29.99, $49.99',
            '$29.99, $49.99, $129.99, $12.99',
            '$129.99, $49.99, $29.99, $12.99',
            'The order does not change from the default'
          ]
        },
        {
          q: 'With items in your cart, you click "Place Order" twice in rapid succession (under one second). What appears in Order History?',
          options: [
            'One order - the second click is rejected with a warning',
            'Two identical orders with the same items and total',
            'One order - a toast says "Order is already processing"',
            'An error: "Duplicate order detected"',
            'The button disables after the first click, preventing the second'
          ]
        },
        {
          q: 'After using ShopLab for about 2 minutes, you click "Add to Cart." The cart count does not update. What does the API Monitor show for /api/cart/add?',
          options: [
            '200 OK with {"success": true, "cartId": "..."}',
            '302 Found - redirecting to a login page',
            '408 Request Timeout',
            '401 Unauthorized with {"error": "Session expired", "code": "SESSION_EXPIRED"}',
            'No entry in the API Monitor - the request was never sent'
          ]
        },
        {
          q: 'Your cart has one item: Wireless Headphones ($49.99). Cart shows Subtotal: $49.99, Shipping: Free, Total: $51.99. What is the most likely cause?',
          options: [
            'A 4% sales tax is automatically applied to all orders',
            'A currency conversion fee was added based on your locale',
            'A $2.00 handling fee is added to the total but not shown as a line item',
            'A floating point rounding error is causing the $2.00 discrepancy',
            'The discount code added a credit that was then automatically reversed'
          ]
        },
        {
          q: 'You click "Add to Cart" on a product. The API Monitor logs the call to GET /api/products/detail. What HTTP status code is shown?',
          options: [
            '200 OK - standard success response for a read request',
            '201 Created - the status code returned by this GET endpoint',
            '204 No Content - server returned an empty body',
            '302 Found - the request was redirected',
            '404 Not Found - the product detail endpoint does not exist'
          ]
        }
      ],
      tasks: [
        {
          title: 'Bug Hunt Report',
          scenario: 'You have tested ShopLab - the demo store in the panel on the right. You explored Products, Cart, Order History, and Contact. You observed both UI behavior and API Monitor responses.',
          question: 'List every bug you found.\n\nFor each bug provide:\n1. What you observed (actual behavior)\n2. Where it occurs (page / feature / element)\n3. Bug type: UI / Functional / API / Data / UX / Accessibility\n4. Severity: Critical / High / Medium / Low\n5. Steps to reproduce',
          placeholder: 'Bug 1:\n  Observed: ...\n  Where: ...\n  Type: ...\n  Severity: ...\n  Steps: 1. ...  2. ...  3. ...\n\nBug 2:\n  Observed: ...\n  ...',
          evalPrompt: 'You are a senior QA lead reviewing a bug hunt report on a demo e-commerce app (ShopLab). Score 0-10 based on the number of unique, sufficiently detailed bugs reported: 0 bugs=0, 1-2=2, 3-4=4, 5-6=5-6, 7-8=7-8, 9-10=9, 11+=10. Raise the score for correct bug type classification, well-justified severity ratings, and reproducible step-by-step instructions. Reduce the score for vague observations, duplicate entries, or missing reproduction steps. Return JSON: {"score": N, "feedback": "2-3 sentences mentioning the number and quality of bugs found"}.'
        },
        {
          title: 'Professional Bug Report',
          scenario: 'Clicking "Place Order" twice rapidly creates duplicate orders in Order History. This is a real data-integrity defect.',
          question: 'Write a complete professional bug report as you would file in Jira or Linear.\n\nInclude:\n- Title\n- Environment / Browser\n- Preconditions\n- Steps to Reproduce (numbered)\n- Expected Result\n- Actual Result\n- Severity and Priority (with justification)\n- Root Cause Hypothesis\n- Suggested Fix',
          placeholder: 'Title: ...\n\nEnvironment: ...\n\nPreconditions: ...\n\nSteps to Reproduce:\n  1. ...\n  2. ...\n  3. ...\n\nExpected: ...\n\nActual: ...\n\nSeverity: ...   Priority: ...\nJustification: ...\n\nRoot Cause Hypothesis: ...\n\nSuggested Fix: ...',
          evalPrompt: 'You are a senior QA engineer evaluating a bug report for a duplicate order issue (rapid double-click on Place Order). Score 0-10: clear and specific title (1 pt), accurate steps including the rapid double-click action (2 pts), correct expected vs actual distinction (1 pt), severity High or Critical with business justification such as data integrity or financial impact (2 pts), root cause mentioning debounce, idempotency key, button disable before async call, or race condition (2 pts), technically sound suggested fix (2 pts). Deduct for vague steps, wrong severity, or missing sections. Return JSON: {"score": N, "feedback": "2-3 sentence evaluation"}.'
        }
      ]
    },

    /* ── 9. AI PROMPTING ──────────────────────────────────────── */
    {
      id: 9,
      domain: 'AI Prompting',
      timerSecs: 1800,    /* 30 minutes */
      mcqs: [],
      tasks: [
        {
          title: 'Prompt for Test Case Generation',
          scenario: 'You are testing a Password Reset feature. The rules are:\n- The email must belong to a registered account\n- The reset link expires after 15 minutes\n- The link can only be used once\n- The new password must be at least 8 characters',
          question: 'Write the exact prompt you would give an AI tool to generate a comprehensive set of test cases for this feature.\n\nYour prompt should produce output that covers positive paths, negative paths, and edge cases.\n\nWrite the full prompt text — exactly as you would paste it into an AI tool.',
          placeholder: 'Your prompt:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating an AI prompt written to generate test cases for a password reset feature. Score 0–10: context quality — does the prompt provide the feature rules and constraints clearly enough for AI to generate relevant tests without guessing? (3 pts); coverage intent — does the prompt explicitly ask for positive, negative, and edge case coverage rather than just "test cases"? (3 pts); output guidance — does the prompt specify an expected format, structure, or level of detail for the output? (2 pts); role/framing — does the prompt set a useful context such as giving AI a QA persona or specifying the purpose? (2 pts). Judge the quality of the prompt itself, not QA knowledge. Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Prompt to Improve a Vague Bug Report',
          scenario: 'A junior QA on your team filed this bug report:\n\n"Title: Checkout is broken\nSteps: I clicked something and it didn\'t work.\nPriority: medium"\n\nYou want to use AI to help transform this into a professional, complete bug report.',
          question: 'Write the prompt you would give an AI to improve this report.\n\nYour prompt should include the original vague report and instruct the AI to produce a complete, professional version with all the sections a good bug report needs.\n\nWrite the full prompt text.',
          placeholder: 'Your prompt:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating an AI prompt written to improve a vague bug report. Score 0–10: does the prompt include the original vague report as input so the AI has something to work with? (2 pts); does the prompt clearly tell the AI what a complete bug report should contain — title, steps to reproduce, expected vs actual, severity, environment, etc.? (4 pts); output clarity — does the prompt ask for a specific, usable output rather than a general review? (2 pts); tone/instruction quality — is the prompt clear, specific, and well-structured? (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Prompt to Plan an Exploratory Testing Session',
          scenario: 'You are about to spend 45 minutes exploratory-testing a new "Bulk CSV Import" feature in a CRM app. It lets users upload a CSV file to import up to 1,000 contacts at once. No test cases exist yet.',
          question: 'Write the prompt you would give an AI to help you plan this exploratory testing session.\n\nYour prompt should get you a structured, actionable guide — covering what areas to test, what risks to look for, and what edge cases to prioritise in your 45 minutes.\n\nWrite the full prompt text.',
          placeholder: 'Your prompt:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating an AI prompt written to plan a 45-minute exploratory testing session for a CSV import feature. Score 0–10: feature description — does the prompt give AI enough context about the feature (CSV, 1000 contacts, CRM, no existing test cases) to produce relevant suggestions? (3 pts); session framing — does the prompt mention the time constraint and ask for a structured, prioritised guide rather than a generic list? (3 pts); coverage breadth — does the prompt ask for risk areas, edge cases, or specific things to check, showing the candidate knows what good exploratory testing looks like? (2 pts); output format — does the prompt specify how the output should be structured so it is immediately usable? (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        },
        {
          title: 'Prompt to Diagnose a Flaky Test',
          scenario: 'A Playwright test has been flaky in CI for two weeks. It sometimes fails with:\n\n"element not found: [data-testid=\'submit-btn\']"\n\nbut passes every time locally. You have the test code and the CI error log and you want AI to help diagnose the cause and suggest a fix.',
          question: 'Write the instruction part of the prompt you would give AI — what you tell it to do and how to respond.\n\nAssume you would paste the test code and error log directly after your instruction.\n\nWrite the full instruction text.',
          placeholder: 'Your prompt:\n...',
          evalPrompt: 'You are a senior QA engineer evaluating an AI prompt written to diagnose a flaky Playwright test. Score 0–10: problem framing — does the prompt clearly describe the symptom (element not found, CI only, passes locally) so the AI understands the context without needing to guess? (3 pts); asks for diagnosis — does the prompt explicitly ask the AI to identify possible causes rather than just "fix this"? (3 pts); asks for a fix — does the prompt ask for a concrete, actionable solution or code change? (2 pts); response structure — does the prompt ask AI to structure its response clearly, e.g. cause first then fix, or numbered steps? (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
        }
      ]
    }
  ];

  /* ─────────────────────────────────────────────────────────────
     ENCODED ANSWER KEY  (single-answer, index-based)
     Formula: _K[di][mi] = answer_index XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     Decode:  answer_index = _K[di][mi] XOR ((di*31 + mi*17 + 0xF3) & 0xFF)
     Index: 0=A, 1=B, 2=C, 3=D, 4=E
     ───────────────────────────────────────────────────────────── */
  var _K = [
    [242,  5, 23, 39, 54, 74, 88],         /* domain 0: Manual Testing        B,B,C,B,B,C,B         */
    [ 16, 33, 52, 71, 87],                 /* domain 1: API Testing            C,C,A,C,B             */
    [ 48, 64, 82,102,116],                 /* domain 2: Back-End Testing       B,C,B,C,B             */
    [ 81, 96,115,130,149],                 /* domain 3: DB Log Reading         B,B,B,B,B             */
    [110,130,147,163,179],                 /* domain 4: Test Automation        B,C,C,B,A             */
    [141,157,177,195,210],                 /* domain 5: Root Cause Analysis    D,C,B,C,A             */
    [172,191,205,225,240],                 /* domain 6: Complex Systems        B,B,C,B,B             */
    [206,223,239,253, 17],                 /* domain 7: AI in QA               C,C,B,C,B             */
    [233,253, 14, 31, 46, 67, 83, 99],     /* domain 8: QA Playground          C,B,D,B,B,D,C,B       */
    []                                     /* domain 9: AI Prompting           no MCQs               */
  ];

  function _dec(di, mi) {
    return _K[di][mi] ^ (((di * 31 + mi * 17 + 0xF3) & 0xFF));
  }

  /* ─────────────────────────────────────────────────────────────
     INTEGRITY - FNV-1a 32-bit signature for sessionStorage
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
     ENGINE STATE - all private to this IIFE
     ───────────────────────────────────────────────────────────── */
  var TOTAL_SECS = 600;
  var CIRC       = 2 * Math.PI * 26;

  /* Returns the timer duration for the current domain (falls back to TOTAL_SECS) */
  function _domSecs() { return (_D[_idx] && _D[_idx].timerSecs) || TOTAL_SECS; }

  var _idx         = 0;
  var _deadline    = 0;
  var _timer       = null;
  var _watchdog    = null;   /* recursive timeout - survives clearInterval bruteforce */
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
       won't match - mark as tampered so it's flagged in submission.  */
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

    if ('IntersectionObserver' in window) {
      var _timerObs = new IntersectionObserver(function (entries) {
        var strip = document.getElementById('stickyTimerStrip');
        if (!strip) return;
        strip.classList.toggle('show', !entries[0].isIntersecting);
      }, {
        rootMargin: '-110px 0px 0px 0px',
        threshold: 0
      });
      var _timerEl = document.querySelector('.timer-wrap');
      if (_timerEl) _timerObs.observe(_timerEl);
    }
  });

  /* Warn before leaving mid-assessment */
  window.addEventListener('beforeunload', function (e) {
    if (!_done) { e.preventDefault(); e.returnValue = ''; }
  });

  /* Track tab switches - signals candidate left to look up answers */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !_done) {
      _tabSwitches++;
    } else if (!document.hidden && _tabSwitches >= 3) {
      /* Warn on return after 3+ switches */
      showFlash('\u26a0\ufe0f Multiple tab switches detected. This is noted in your submission.');
    }
  });

  /* ── Render domain ─────────────────────────────────────────── */
  function renderDomain(idx) {
    var domain = _D[idx];

    /* Split-screen toggle for QA Playground */
    if (domain.playground) { setupSplitMode(); }
    else                   { teardownSplitMode(); }

    _sel = Array.from({ length: domain.mcqs.length }, function () { return []; });

    /* Progress */
    document.getElementById('progressFill').style.width   = ((idx / _D.length) * 100) + '%';
    document.getElementById('progressLabel').textContent  = 'Domain ' + (idx + 1) + ' of ' + _D.length;
    document.getElementById('progressDomain').textContent = domain.domain;

    /* Header */
    document.getElementById('domainBadge').textContent = domain.domain;
    document.getElementById('domainTitle').textContent = domain.domain;

    /* Sticky strip domain label */
    var _sd = document.getElementById('stickyDomain');
    if (_sd) _sd.textContent = domain.domain;

    /* MCQs */
    var mcqEl = document.getElementById('mcqContainer');
    mcqEl.innerHTML = '';
    document.getElementById('mcqSectionHeader').style.display =
      domain.mcqs.length ? '' : 'none';

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
        cb.value  = oi;

        var chkBox = document.createElement('span');
        chkBox.className = 'mcq-checkbox';

        var marker = document.createElement('span');
        marker.className   = 'mcq-marker';
        marker.textContent = String.fromCharCode(65 + oi);

        var span = document.createElement('span');
        span.textContent = opt;

        lbl.appendChild(cb);
        lbl.appendChild(chkBox);
        lbl.appendChild(marker);
        lbl.appendChild(span);
        opts.appendChild(lbl);

        cb.addEventListener('change', (function (capturedQi, capturedOi, capturedLbl) {
          return function () {
            var arr       = _sel[capturedQi];
            var pos       = arr.indexOf(capturedOi);
            var selMarker = capturedLbl.querySelector('.mcq-marker');
            if (this.checked) {
              if (pos === -1) arr.push(capturedOi);
              capturedLbl.classList.add('selected');
              if (selMarker) {
                selMarker.style.background = 'var(--white)';
                selMarker.style.color = 'var(--text-inv)';
              }
            } else {
              if (pos > -1) arr.splice(pos, 1);
              capturedLbl.classList.remove('selected');
              if (selMarker) { selMarker.style.background = ''; selMarker.style.color = ''; }
            }
          };
        })(qi, oi, lbl));
      });

      block.appendChild(qnum);
      block.appendChild(qtxt);
      block.appendChild(opts);
      mcqEl.appendChild(block);
    });

    /* Tasks */
    var taskEl = document.getElementById('taskContainer');
    taskEl.innerHTML = '';
    document.getElementById('taskSectionHeader').style.display =
      domain.tasks.length ? '' : 'none';

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
    var _submitBtnEl = document.getElementById('submitBtn');
    _submitBtnEl.onclick = function () { submitDomain(false); };
    _submitBtnEl.innerHTML = (_idx >= _D.length - 1)
      ? 'Submit Assessment'
      : 'Submit &amp; Next Domain →';

    /* ── Resume or start timer ─────────────────────────────────────
       Persist the deadline in sessionStorage so the back-button
       navigation does not reset the clock.
       Three cases on load:
         a) No saved deadline → fresh domain, start 10-min clock.
         b) Saved deadline still in the future → resume remaining time.
         c) Saved deadline already passed → time expired while away,
            auto-submit immediately.                                    */
    var _savedDeadline = parseInt(sessionStorage.getItem('qa_domain_deadline') || '0', 10);
    var _savedStart    = parseInt(sessionStorage.getItem('qa_domain_start')    || '0', 10);

    /* Security: cap any resumed deadline to original domain start + _domSecs() + 5s grace.
       Prevents DevTools attack: sessionStorage.setItem('qa_domain_deadline', 9999999999999) */
    if (_savedDeadline > 0 && _savedStart > 0) {
      var _maxDeadline = _savedStart + (_domSecs() + 5) * 1000;
      if (_savedDeadline > _maxDeadline) _savedDeadline = _maxDeadline;
    }

    if (_savedDeadline > 0 && _savedDeadline <= _now()) {
      /* Case (c): expired while away - submit with whatever was entered */
      submitDomain(true);
      return;
    }

    /* Auto-submit time label - use saved deadline if resuming */
    var _labelDeadline = (_savedDeadline > _now()) ? _savedDeadline : (_now() + _domSecs() * 1000);
    var _autoTimeStr = new Date(_labelDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('autoSubmitAt').textContent = _autoTimeStr;

    /* Also update split-panel auto-submit time (set after _deadline is known) */
    var _splitAt = document.getElementById('splitAutoTime');
    if (_splitAt) _splitAt.textContent = _autoTimeStr;

    startTimer(_savedDeadline > _now() ? _savedDeadline : 0);
    /* In split mode the left panel scrolls independently; in normal mode scroll the window */
    if (document.body.classList.contains('split-mode')) {
      var _card = document.getElementById('assessmentCard');
      if (_card) _card.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ── Timer ─────────────────────────────────────────────────────
     Wall-clock deadline - immune to secondsLeft manipulation.
     _now() is captured at IIFE init so Date.now spoofing from
     the console has no effect.
     Watchdog uses recursive setTimeout (not setInterval) so its
     ID changes every 3 s - brute-force clearInterval(1..9999)
     cannot reliably kill it.                                      */
  function startTimer(resumeDeadline) {
    clearInterval(_timer);
    clearTimeout(_watchdog);
    _warnShown   = false;
    _domainStart = _now();

    /* Resume an existing deadline (back-button case) or start fresh */
    if (resumeDeadline && resumeDeadline > _now()) {
      _deadline = resumeDeadline;
    } else {
      _deadline = _now() + _domSecs() * 1000;
      /* Store domain start timestamp so deadline extension exploit is capped on reload */
      sessionStorage.setItem('qa_domain_start', String(_now()));
    }

    /* Persist so page reload / back-navigation can restore remaining time */
    sessionStorage.setItem('qa_domain_deadline', String(_deadline));

    var initialRem = Math.max(0, Math.round((_deadline - _now()) / 1000));
    updateTimer(initialRem);

    /* Display timer - updates the UI every 500 ms */
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

    /* Watchdog - force-submits even if display timer is killed */
    (function watchdog() {
      _watchdog = setTimeout(function () {
        if (_done) return;
        var rem = Math.round((_deadline - _now()) / 1000);
        if (rem <= 0) { submitDomain(true); return; }
        watchdog(); /* reschedule - new ID each time */
      }, 3000);
    }());
  }

  function updateTimer(rem) {
    var m = Math.floor(rem / 60);
    var s = rem % 60;

    var el   = document.getElementById('timerDisplay');
    var ring = document.getElementById('timerRing');

    el.textContent = pad(m) + ':' + pad(s);

    var fraction = rem / _domSecs();
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

    /* Mirror to sticky timer strip */
    var sEl = document.getElementById('stickyTimerDisplay');
    if (sEl) {
      sEl.textContent = pad(m) + ':' + pad(s);
      sEl.classList.remove('warning', 'danger');
      if (rem <= 30)       sEl.classList.add('danger');
      else if (rem <= 120) sEl.classList.add('warning');
    }

    /* Mirror to split-screen compact timer */
    var spEl = document.getElementById('splitTimerVal');
    if (spEl) {
      spEl.textContent = pad(m) + ':' + pad(s);
      spEl.className = 'split-timer-val';
      if (rem <= 30)       spEl.classList.add('danger');
      else if (rem <= 120) spEl.classList.add('warning');
    }
  }

  /* ── Submit ────────────────────────────────────────────────── */
  function submitDomain(isAuto) {
    clearInterval(_timer);
    clearTimeout(_watchdog);

    /* Clear persisted deadline + start - next domain must get a fresh 10-min clock */
    sessionStorage.removeItem('qa_domain_deadline');
    sessionStorage.removeItem('qa_domain_start');

    var domain   = _D[_idx];
    var timeUsed = Math.round((_now() - _domainStart) / 1000);

    var btn = document.getElementById('submitBtn');
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    if (isAuto) showFlash('Time\'s up - domain auto-submitted.');

    /* Grade MCQs -_dec returns the correct answer index (0=A … 4=E).
       _sel[qi] is an array of selected indices ([] = no answer).
       Correct only when exactly the one right option is chosen alone.   */
    var mcqResults = domain.mcqs.map(function (_, qi) {
      var selArr  = _sel[qi];
      var corrIdx = _dec(_idx, qi);
      var isCorrect = selArr.length === 1 && selArr[0] === corrIdx;
      return { selectedIdx: selArr, correctIdx: corrIdx, isCorrect: isCorrect };
    });

    /* Collect task answers */
    var taskAnswers = domain.tasks.map(function (_, ti) {
      var el = document.getElementById('task_' + ti);
      return el ? el.value.trim() : '';
    });

    /* Speed-run flag — flag if less than 15% of the allocated time was used */
    var suspicious = timeUsed < Math.round(_domSecs() * 0.15);

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

    /* Sign the stored data - detects sessionStorage tampering on results page */
    var sigPayload = { r: _responses, t: _timings, e: (_candidate && _candidate.email) || '' };
    sessionStorage.setItem('qa_sig', _sig(sigPayload));

    /* Last domain → lock submission, send everything, redirect */
    if (_idx >= _D.length - 1) {
      _done = true;
      sessionStorage.setItem('qa_current_task', String(_D.length));

      /* Submitted-lock - tamper-evident flag prevents retaking
         even if qa_current_task is reset to 0 in DevTools      */
      sessionStorage.setItem('qa_submitted',     '1');
      sessionStorage.setItem('qa_submitted_sig',
        _sig({ s: 1, e: (_candidate && _candidate.email) || '' }));

      /* Persist integrity flags so thankyou.html can warn the candidate */
      sessionStorage.setItem('qa_integrity', JSON.stringify({
        tampered:    _tampered,
        tabSwitches: _tabSwitches
      }));

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
      teardownSplitMode();
      document.getElementById('autosubmitNotice').style.display = 'none';
      btn.disabled  = false;
      card.style.opacity = '1';
      renderDomain(_idx);
    }, 250);
  }

  /* ── Split-screen (QA Playground) ─────────────────────────── */
  function setupSplitMode() {
    if (document.body.classList.contains('split-mode')) return;
    document.body.classList.add('split-mode');

    /* Inject right panel with browser chrome bar + iframe */
    var card = document.getElementById('assessmentCard');
    if (card && card.parentNode && !document.getElementById('splitRight')) {
      var right = document.createElement('div');
      right.id = 'splitRight';
      right.className = 'split-right';
      right.innerHTML =
        '<div class="split-right-inner">' +
          '<div class="split-app-bar">' +
            '<span class="split-app-dot" style="background:#ef4444"></span>' +
            '<span class="split-app-dot" style="background:#f59e0b;margin-left:4px"></span>' +
            '<span class="split-app-dot" style="background:#22c55e;margin-left:4px"></span>' +
            '<span class="split-app-title">ShopLab - Demo Store</span>' +
          '</div>' +
          '<iframe src="demo-app.html" title="ShopLab Test Application" allow="clipboard-write"></iframe>' +
        '</div>';
      card.parentNode.insertBefore(right, card.nextSibling);
    }

    /* Inject compact timer at top of left panel */
    if (card && !document.getElementById('splitTimerBar')) {
      var bar = document.createElement('div');
      bar.id = 'splitTimerBar';
      bar.className = 'split-timer-bar';
      bar.innerHTML =
        '<div>' +
          '<div class="split-timer-label">Time Remaining</div>' +
        '</div>' +
        '<div class="split-timer-val" id="splitTimerVal">10:00</div>' +
        '<div class="split-auto-at" id="splitAutoAt"><div class="split-timer-label">Auto-submits</div><strong id="splitAutoTime">-</strong></div>';
      card.insertBefore(bar, card.firstChild);

      /* Set auto-submit time */
      var labelDeadline = (_deadline > 0 && _deadline > _now()) ? _deadline : (_now() + _domSecs() * 1000);
      var atEl = document.getElementById('splitAutoTime');
      if (atEl) atEl.textContent = new Date(labelDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* Wrap submit button row in sticky bar */
    var submitRow = document.getElementById('submitRow');
    if (submitRow && !submitRow.classList.contains('split-submit-bar')) {
      submitRow.classList.add('split-submit-bar');
    }

    /* Force sticky timer strip to show (replaces the hidden .timer-wrap) */
    var strip = document.getElementById('stickyTimerStrip');
    if (strip) strip.classList.add('show');
  }

  function teardownSplitMode() {
    if (!document.body.classList.contains('split-mode')) return;
    document.body.classList.remove('split-mode');
    var right = document.getElementById('splitRight');
    if (right && right.parentNode) right.parentNode.removeChild(right);
    var bar = document.getElementById('splitTimerBar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    var strip = document.getElementById('stickyTimerStrip');
    if (strip) strip.classList.remove('show');
    var submitRow = document.getElementById('submitRow');
    if (submitRow) submitRow.classList.remove('split-submit-bar');
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
      totalMcqScore: 0,
      totalDomains:  _D.length,
      tampered:      _tampered,
      tabSwitches:   _tabSwitches
    };

    var totalMcq = 0;
    _D.forEach(function (d) {
      var key  = 'domain_' + d.id;
      var resp = _responses[key] || {};
      flat[key + '_mcq_score']   = resp.mcqScore    || 0;
      flat[key + '_mcq_answers'] = JSON.stringify(resp.mcqResults || []);
      d.tasks.forEach(function (_, ti) {
        flat[key + '_task_' + (ti + 1)] = (resp.taskAnswers && resp.taskAnswers[ti]) || '';
      });
      flat[key + '_time_secs']   = _timings[key + '_secs'] || 0;
      flat[key + '_suspicious']  = !!(resp.suspicious);
      totalMcq += resp.mcqScore || 0;
    });
    flat.totalMcqScore = totalMcq;

    var sheetsP = Promise.resolve();
    if (SHEETS_ENDPOINT) {
      /* Include token in the body (no-cors mode blocks custom headers) */
      var sheetsPayload = Object.assign({}, flat, { token: QA_TOKEN });
      sheetsP = fetch(SHEETS_ENDPOINT, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sheetsPayload)
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

      /* Include token as a request header for the Worker */
      var workerHeaders = { 'Content-Type': 'application/json' };
      if (QA_TOKEN) workerHeaders['X-QA-Token'] = QA_TOKEN;

      evalP = fetch(AI_EVAL_ENDPOINT, {
        method:  'POST',
        headers: workerHeaders,
        body:    JSON.stringify({ candidateEmail: _candidate.email, tasks: evalPayload })
      }).then(function (res) {
        if (res.ok) {
          return res.json().then(function (data) {
            sessionStorage.setItem('qa_ai_scores', JSON.stringify(data));
          });
        }
      }).catch(function (err) { console.error('AI evaluation failed:', err); });
    }

    /* Race against a 30-second timeout so the page never hangs on a dead network */
    var timeoutP = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('submission timeout')); }, 30000);
    });
    return Promise.race([Promise.all([sheetsP, evalP]), timeoutP]);
  }

  /* ── Expose domain list for thankyou.html (metadata only — no question text or eval prompts) */
  window.DOMAINS = _D.map(function (d) {
    return {
      id:         d.id,
      domain:     d.domain,
      playground: !!d.playground,
      mcqs:       new Array(d.mcqs.length),          /* preserve .length, strip question content */
      tasks:      d.tasks.map(function (t) {
        return { title: t.title };                   /* preserve title for display, strip evalPrompt */
      })
    };
  });

})();
