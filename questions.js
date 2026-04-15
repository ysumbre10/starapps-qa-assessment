/* eslint-disable no-unused-vars */
/**
 * QA Skill Check — All Assessment Content
 *
 * Each domain has:
 *  - 3 MCQs (options array, correct = 0-indexed)
 *  - 2 open tasks (scenario + question + AI evaluation prompt)
 *
 * The `evalPrompt` on each task is sent to Claude to score the answer 0–10.
 */

const DOMAINS = [
  // ─────────────────────────────────────────────────────
  // 1. API TESTING
  // ─────────────────────────────────────────────────────
  {
    id: 1,
    domain: 'API Testing',
    mcqs: [
      {
        q: 'You send POST /api/orders with a valid body and receive 200 OK instead of the expected response. Which status code should a well-designed REST API return when a resource is successfully created?',
        options: [
          '200 OK — it signals success, so it\'s acceptable for creation',
          '201 Created — it specifically communicates that a new resource was created',
          '202 Accepted — it means the request was accepted for processing',
          '204 No Content — it means success with no body to return'
        ],
        correct: 1
      },
      {
        q: 'An API returns the same response for GET /users/999 (non-existent user) as for GET /users/1 (valid user), just with empty data fields. What is the problem from a testing perspective?',
        options: [
          'No problem — empty fields are a valid way to represent missing data',
          'The API should return 404 Not Found for non-existent resources; returning 200 with empty data makes it impossible to distinguish "not found" from "found but empty"',
          'The API should return 500 Internal Server Error when data is not found',
          'The response body format is incorrect but the status code is fine'
        ],
        correct: 1
      },
      {
        q: 'Which of the following test cases would catch an Insecure Direct Object Reference (IDOR) vulnerability in a REST API?',
        options: [
          'Send a request with a malformed JSON body and verify the API returns 400',
          'Call GET /api/users/123/orders using an auth token belonging to user 456 and verify the API returns 403',
          'Verify the API returns 429 after sending 1000 requests in one second',
          'Test that the API returns correct data when the database is under heavy load'
        ],
        correct: 1
      }
    ],
    tasks: [
      {
        title: 'Design a Test Suite for a Payment API',
        scenario:
          'POST /api/v1/payments\n\nRequest body:\n{\n  "card_token": "tok_visa_4242",\n  "amount": 4999,        // in cents\n  "currency": "USD",\n  "idempotency_key": "order-78234-attempt-1"\n}\n\nResponse:\n{\n  "payment_id": "pay_xK92mN",\n  "status": "pending" | "completed" | "failed",\n  "charged_at": "2024-03-10T14:32:01Z"\n}',
        question:
          'Write 8–10 test cases covering:\n1. Happy path\n2. Edge cases (amount = 0, amount = negative, missing currency)\n3. Negative cases (invalid card token, expired card, duplicate idempotency_key)\n4. At least one security check\n\nFor each test case state: input, expected HTTP status, expected response, and what bug it would catch if it fails.',
        placeholder: 'List your test cases clearly. Use a structured format: TC-01, TC-02, etc.',
        evalPrompt: 'You are a senior QA engineer evaluating a test plan for a payment API. Score the answer from 0–10 based on: coverage of happy/edge/negative/security cases (4 pts), correctness of expected statuses and responses (3 pts), clarity and structure (2 pts), and depth of bug-catching insight (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Debug an Intermittent 401 on a Valid Token',
        scenario:
          'Your frontend calls GET /api/v1/user/profile with a valid, non-expired JWT token. Roughly 1 in 20 requests returns 401 Unauthorized. The issue does not reproduce locally or in staging. It only happens in production under normal traffic. No changes were made to the auth service recently.',
        question:
          'What are your top 3 hypotheses for why this is happening?\nFor each hypothesis:\n- What evidence would confirm it?\n- What evidence would rule it out?\n- What would you check in the logs/infra?\n\nFinally: what test cases would you add to the regression suite to catch this class of issue in future?',
        placeholder: 'State each hypothesis clearly, then walk through your investigation logic.',
        evalPrompt: 'You are a senior QA/backend engineer evaluating a debugging analysis for an intermittent 401 error. Score 0–10: quality of hypotheses (clock skew, load balancer sticky sessions, token validation race condition, caching) (4 pts), investigation methodology (3 pts), regression test cases proposed (2 pts), overall reasoning quality (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 2. BACK-END TESTING
  // ─────────────────────────────────────────────────────
  {
    id: 2,
    domain: 'Back-End Testing',
    mcqs: [
      {
        q: 'A background job is supposed to process 10,000 records per run. It completes without errors, but only 9,847 records are marked as processed in the database. What do you investigate first?',
        options: [
          'Increase the job\'s memory allocation and re-run — it\'s likely an out-of-memory issue',
          'Check for silent exception handling that swallows errors, duplicate-detection logic that may over-filter, or records being skipped by a WHERE clause',
          'Assume the 153 missing records were invalid inputs that were correctly rejected',
          'Add a retry mechanism to re-process all 10,000 records'
        ],
        correct: 1
      },
      {
        q: 'What is the key difference between a unit test and an integration test?',
        options: [
          'Unit tests always use mocks; integration tests never use mocks',
          'Unit tests test a single function in isolation; integration tests verify that multiple components work correctly together',
          'Integration tests are run only in production environments',
          'Unit tests require a running database; integration tests run in memory'
        ],
        correct: 1
      },
      {
        q: 'A service passes all tests in CI but crashes under real production load every few hours. Which testing technique is specifically designed to catch this class of issue?',
        options: [
          'Boundary value analysis',
          'Equivalence partitioning',
          'Load and stress testing',
          'Exploratory testing'
        ],
        correct: 2
      }
    ],
    tasks: [
      {
        title: 'Investigate Silent Message Loss in a Kafka Consumer',
        scenario:
          'The order service emits ~500 order_created events per hour to a Kafka topic. The inventory service consumes the same topic and should process every event — but it only processes ~480/hour. Over 8 hours, 160 orders have no inventory update.\n\nObservations:\n- No errors or exceptions in inventory service logs\n- Dead letter queue is empty\n- Consumer group lag is near zero\n- The 20 missing orders look identical to the 480 that succeed',
        question:
          'List your investigation steps in priority order. For each step:\n1. What are you checking and why?\n2. What would confirm your hypothesis?\n3. What would rule it out?\n\nThen write 2 test cases that would catch this issue before it reaches production.',
        placeholder: 'Walk through your debugging process clearly. Show your reasoning.',
        evalPrompt: 'You are a senior backend/QA engineer evaluating a debugging approach for silent Kafka message loss. Score 0–10: quality of hypotheses (idempotency filter, partition assignment, deserialization silently failing, consumer offset issue) (4 pts), investigation methodology and priority ordering (3 pts), test cases proposed (2 pts), reasoning quality (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Identify Regression Risks in a Refactored Pricing Engine',
        scenario:
          'A developer refactored the order pricing engine. The original code applied discounts sequentially:\n  1. Apply loyalty discount (10%)\n  2. Apply coupon discount (flat $5 off)\n  3. Apply bulk discount (5% if qty > 10)\n\nThe new code applies all three discounts in parallel and sums the discount amounts.\n\nAll existing unit tests pass. The developer says "the math is equivalent."',
        question:
          'Is the developer correct that the math is equivalent? Why or why not?\n\nWrite 3 specific test cases with concrete inputs and expected outputs that would validate the refactor is safe — or reveal a bug. Explain what each test case is checking.',
        placeholder: 'Think carefully about order of operations and discount stacking. Show your working.',
        evalPrompt: 'You are a senior QA engineer evaluating a regression analysis for a pricing engine refactor. The correct answer is that the math is NOT equivalent — sequential discounts compound (percentage discounts apply to already-reduced prices) while parallel discount summing does not. Score 0–10: correct identification of the compounding vs parallel issue (4 pts), quality of test cases with correct expected values (4 pts), clarity of explanation (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 3. DB LOG READING
  // ─────────────────────────────────────────────────────
  {
    id: 3,
    domain: 'DB Log Reading',
    mcqs: [
      {
        q: 'In a PostgreSQL EXPLAIN ANALYZE output, you see: "rows=50 (actual rows=48200)". What does this discrepancy mean?',
        options: [
          'The query returned 48,200 rows but the planner expected 50 — the table statistics are stale and need ANALYZE to be run',
          'The query failed and only 50 rows were returned instead of 48,200',
          'The planner estimate is always conservative and this is expected behavior',
          'There is a bug in the query — it returned too many rows'
        ],
        correct: 0
      },
      {
        q: 'You see this in production logs every few minutes during peak hours:\n"ERROR: deadlock detected — process 18234 waits for ShareLock on transaction 9182; blocked by process 18901"\n\nWhat is the most effective immediate investigation step?',
        options: [
          'Restart the database server to clear all locks',
          'Increase the deadlock_timeout setting to reduce false positives',
          'Identify which tables and rows are involved in the conflicting transactions, and check if they can be accessed in a consistent order',
          'Add more database replicas to distribute the write load'
        ],
        correct: 2
      },
      {
        q: 'A query runs in 20ms in staging but takes 4,300ms in production on the same data. EXPLAIN shows "Seq Scan" in production but "Index Scan" in staging. What is the most likely cause?',
        options: [
          'The index exists in staging but was not migrated to production',
          'The production server has slower hardware than staging',
          'The query planner in production chose a sequential scan because the table statistics show the index is not selective enough for the current data distribution, or the index is missing',
          'The production database is running an older version of PostgreSQL'
        ],
        correct: 2
      }
    ],
    tasks: [
      {
        title: 'Diagnose This Production Log Sequence',
        scenario:
          '2024-03-10 14:32:01 [WARN]  Slow query: 4320ms\n                            SELECT * FROM orders WHERE user_id=9182 AND status=\'PENDING\'\n\n2024-03-10 14:32:04 [ERROR] Deadlock detected when trying to get lock\n                            Tables involved: orders, order_items\n\n2024-03-10 14:32:04 [ERROR] Transaction rollback: order_id=78234\n                            Reason: lock wait timeout exceeded\n\n2024-03-10 14:32:05 [INFO]  Retry attempt 1/3 for order_id=78234\n\n2024-03-10 14:32:09 [ERROR] Retry failed. Max retries reached.\n                            order_id=78234 status set to FAILED.',
        question:
          '1. Walk through exactly what happened here in plain English — step by step.\n2. What is the root cause?\n3. What would you report to the developer? Be specific about what needs to change in the code or schema.\n4. Write 3 test cases to prevent this regression — include what input triggers the scenario and what the expected behavior should be.',
        placeholder: 'Interpret the log carefully. Explain your reasoning at each step.',
        evalPrompt: 'You are a senior DB/QA engineer evaluating an analysis of a deadlock log. The correct interpretation: a slow query (missing index on status column) held locks; a concurrent transaction caused a deadlock; retry logic was exhausted and the order failed. Score 0–10: correct event sequence interpretation (3 pts), correct root cause (missing index + lock ordering issue) (3 pts), developer report quality (2 pts), test case quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Pre-Migration Test Plan for a Schema Change',
        scenario:
          'Your team is running this migration on the orders table (50 million rows) in production next Friday:\n\n  ALTER TABLE orders ADD COLUMN fulfilled_by VARCHAR(100) NOT NULL DEFAULT \'system\';\n  CREATE INDEX CONCURRENTLY idx_orders_fulfilled_by ON orders(fulfilled_by);\n\nStaging ran fine. Production has 50M rows and ~500 writes/second during peak hours.',
        question:
          'What could go wrong during this migration on a live 50M-row table?\n\nWrite:\n1. A pre-migration checklist (at least 5 items)\n2. 3 specific test cases to validate the migration succeeded correctly\n3. A rollback plan if something goes wrong mid-migration',
        placeholder: 'Think about table locking, disk space, index build time, and live traffic impact.',
        evalPrompt: 'You are a senior DBA/QA engineer evaluating a migration test plan. Key concerns: NOT NULL + DEFAULT on 50M rows causes table rewrite in older Postgres (use nullable first, backfill, then add NOT NULL constraint); CREATE INDEX CONCURRENTLY is correct; disk space for index; replication lag. Score 0–10: identification of key risks (4 pts), checklist quality (3 pts), test cases and rollback plan (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 4. TEST AUTOMATION
  // ─────────────────────────────────────────────────────
  {
    id: 4,
    domain: 'Test Automation',
    mcqs: [
      {
        q: 'Your Playwright test consistently passes locally but fails in CI with "Element not found" on a button that appears after an async API call. What is the correct fix?',
        options: [
          'Add await page.waitForTimeout(3000) before the click to give the API time to respond',
          'Use await expect(page.getByTestId("submit-btn")).toBeVisible() which waits automatically until the element appears or the timeout is hit',
          'Increase the default global timeout in playwright.config.ts to 60 seconds',
          'Wrap the click in a try/catch and retry 3 times with a 1-second sleep'
        ],
        correct: 1
      },
      {
        q: 'What is the primary problem with this Selenium selector:\ndriver.findElement(By.xpath("//div[@class=\'container\']/div[2]/button[1]"))',
        options: [
          'XPath selectors cannot target button elements',
          'The class attribute is not a valid XPath attribute',
          'It is positionally fragile — any change to the DOM structure (adding a sibling div, reordering buttons) will break the test even if the target button is completely unchanged',
          'It is significantly slower than an equivalent CSS selector'
        ],
        correct: 2
      },
      {
        q: 'Your automation suite has 300 tests. 60 are "flaky" — they pass and fail randomly without code changes. A developer suggests deleting all flaky tests. What is the correct response?',
        options: [
          'Agree — flaky tests are worse than no tests because they erode trust in the suite',
          'Disagree — flaky tests should be quarantined and fixed, not deleted. Flakiness usually points to real issues: race conditions, test interdependency, or environment instability',
          'Agree — delete and rewrite them from scratch using a different framework',
          'Disagree — run flaky tests 3 times and only fail the build if all 3 fail'
        ],
        correct: 1
      }
    ],
    tasks: [
      {
        title: 'Write Automation for a Multi-Step Checkout Flow',
        scenario:
          'An e-commerce checkout flow:\n  Step 1: Cart page — shows items, "Proceed to Checkout" button\n  Step 2: Address form — name, address, city, postcode (all required)\n  Step 3: Payment form — card number, expiry (MM/YY), CVV\n  Step 4: Confirmation page — shows "Order confirmed!" and an order ID like ORD-XXXXX\n\nTest IDs available:\n  data-testid="checkout-btn"\n  data-testid="address-name", "address-street", "address-city", "address-postcode"\n  data-testid="card-number", "card-expiry", "card-cvv", "pay-btn"\n  data-testid="order-id"  (on confirmation page)',
        question:
          'Write a Playwright or Cypress test covering:\n(a) Full happy path from cart to order confirmation — assert that an order ID is displayed\n(b) One negative test: payment declined — assert the correct error message is shown and the user stays on the payment page\n\nMention which framework you are using. Write clean, readable code.',
        placeholder: 'Paste your test code here. State the framework at the top.',
        evalPrompt: 'You are a senior SDET evaluating automation test code for a checkout flow. Score 0–10: correct use of async/await and framework-appropriate syntax (2 pts), use of data-testid selectors (2 pts), happy path completeness including order ID assertion (2 pts), negative test quality (2 pts), overall code readability and structure (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Fix a Brittle Automation Suite',
        scenario:
          'You inherit an automation suite with these problems:\n- Tests pass locally but fail in CI 30% of the time\n- Tests sometimes affect each other — running them in a different order changes results\n- A single UI text change ("Submit" → "Confirm") broke 47 tests\n- Tests take 45 minutes to run, blocking deployments\n\nThe team is considering abandoning automation entirely.',
        question:
          'For each of the four problems listed, identify the root cause and write a specific fix.\n\nThen: should the team abandon automation? What is your recommendation, and what would a healthy automation strategy look like for a team in this state?',
        placeholder: 'Address each problem systematically. Be specific — not just "use better selectors" but HOW.',
        evalPrompt: 'You are a senior SDET evaluating automation troubleshooting advice. Expected answers: CI flakiness (async waits, test isolation, environment consistency); test order dependency (shared state, teardown issues, isolated test data); brittle text selectors (use data-testid, role-based selectors); slow suite (parallel execution, test pyramid, selective runs). Score 0–10: correct root cause per problem (4 pts), specific actionable fixes (4 pts), recommendation quality (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 5. ROOT CAUSE ANALYSIS
  // ─────────────────────────────────────────────────────
  {
    id: 5,
    domain: 'Root Cause Analysis',
    mcqs: [
      {
        q: 'A production bug cannot be reproduced in staging after 4 hours of investigation. The bug is still affecting real users. What is the best next action?',
        options: [
          'Close the ticket as "cannot reproduce" and add monitoring to detect recurrence',
          'Immediately copy the full production database to staging to test with real data',
          'Add detailed structured logging to the production code path and deploy, then wait for the next occurrence to capture full context',
          'Escalate to the developer and ask them to fix it without being able to reproduce it'
        ],
        correct: 2
      },
      {
        q: 'Which of the following correctly applies the 5 Whys technique to: "The website was down for 2 hours on Monday"?',
        options: [
          'Why? → Server crashed. Fix: replace server. (2 whys is enough for hardware issues)',
          'Why? → Server crashed → Why? → Disk full → Why? → Logs not rotated → Why? → No log rotation config → Why? → Not included in the deployment runbook. Root cause: missing ops process',
          'Why? → Server crashed → Why? → Too much traffic → Root cause: need more servers',
          'Why? → Server crashed → Why? → Someone deployed bad code → Root cause: need better code review'
        ],
        correct: 1
      },
      {
        q: 'A race condition bug occurs roughly 1 in every 500 test runs. Which approach is most effective at catching this reliably in a CI pipeline?',
        options: [
          'Add a sleep() between the two racing operations and hope it triggers the condition',
          'Run the test 500 times in a loop in CI and fail the build if it ever fails',
          'Use concurrency testing tools, thread sanitizers, or stress testing that amplifies timing windows — and review the code for missing synchronization primitives',
          'Mark the test as expected-to-fail and document the race condition'
        ],
        correct: 2
      }
    ],
    tasks: [
      {
        title: 'RCA: Checkout Bug on iOS 16 Safari',
        scenario:
          'Bug report (filed by 3 separate users):\n"The Place Order button on checkout does nothing when tapped on iPhone 14 running iOS 16.4 with Safari. No error message. The button just doesn\'t respond."\n\nConfirmed working:\n  ✓ Chrome desktop, Firefox desktop, Safari desktop\n  ✓ Android Chrome (all versions tested)\n  ✓ iOS 15 Safari\n  ✗ iOS 16 Safari (all iPhone models)',
        question:
          'Apply the 5-Whys framework to identify the most likely root cause.\n\nThen answer:\n1. What would you check technically first? (JS errors, CSS, event listeners, network)\n2. Why was this not caught in QA before release? Apply 5-Whys to the process failure, not just the technical bug.\n3. What two process changes would prevent this class of platform-specific bug in the future?',
        placeholder: 'Be structured. Separate the technical RCA from the process RCA.',
        evalPrompt: 'You are a senior QA engineer evaluating a root cause analysis for a platform-specific bug. The technical root cause is likely a CSS/JS change incompatible with Safari iOS 16 (e.g., passive event listeners, scroll behavior, or a specific CSS property). The process failure is lack of cross-browser/cross-OS test coverage in the regression suite. Score 0–10: 5-Whys quality and depth (3 pts), technical investigation specificity (2 pts), process failure analysis quality (3 pts), prevention recommendations (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Write a Post-Mortem for a Payment Outage',
        scenario:
          'Incident timeline:\n  14:32 — Deployment of config change pushed to production without review\n  14:34 — Payment service error rate climbs from 0.1% to 87%\n  14:38 — On-call alerted by PagerDuty\n  14:41 — Engineers begin investigation\n  14:58 — Root cause identified: config change set DB connection pool max_connections to 2 (was 50)\n  15:01 — Config reverted\n  15:19 — Service fully recovered\n\nImpact: 47 minutes of degraded service. 1,240 payment transactions failed. Estimated revenue impact: $43,000.',
        question:
          'Write a complete post-mortem report with these sections:\n1. Summary (2–3 sentences)\n2. Timeline (use the data above)\n3. Root cause and contributing factors\n4. Impact\n5. Action items — at least 4, each with a specific owner role and a deadline\n\nBe concise but complete. This report would be shared with the engineering team and leadership.',
        placeholder: 'Structure your post-mortem clearly. Action items should be specific and actionable.',
        evalPrompt: 'You are a senior engineering manager evaluating a post-mortem report. Score 0–10: clear factual summary (1 pt), accurate timeline (2 pts), root cause AND contributing factors (not just "someone pushed bad config" — also: no config review process, no staging validation, no automated config validation) (3 pts), impact statement with numbers (1 pt), quality and specificity of action items with owners and deadlines (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 6. COMPLEX SYSTEMS
  // ─────────────────────────────────────────────────────
  {
    id: 6,
    domain: 'Complex Systems',
    mcqs: [
      {
        q: 'Service A calls Service B, which calls Service C. Service C becomes slow (p99 latency: 8 seconds). Which pattern prevents this from cascading and making Service A unresponsive?',
        options: [
          'Add retry with exponential backoff on Service A\'s call to Service B',
          'Implement a circuit breaker on Service B\'s call to Service C — after N failures it opens and Service B returns a fast fallback instead of waiting',
          'Increase the HTTP timeout on Service A\'s call to Service B to 30 seconds',
          'Add a message queue between Service B and Service C so Service B can continue processing'
        ],
        correct: 1
      },
      {
        q: 'A user\'s order data shows correctly in Region A but is missing in Region B immediately after creation. 10 minutes later it appears in both regions. What is the most likely cause?',
        options: [
          'The user\'s browser cached the old data and needed to be refreshed',
          'An authentication token expired in Region B causing a read failure',
          'Replication lag between data centers — the system is eventually consistent and the write had not yet propagated to Region B',
          'The CDN is serving a stale cached API response in Region B'
        ],
        correct: 2
      },
      {
        q: 'What does "observability" mean in the context of distributed system testing, and why does it matter for QA?',
        options: [
          'The ability to monitor CPU and memory usage of each service via a dashboard',
          'The ability to understand a system\'s internal state purely from its external outputs — logs, metrics, and distributed traces — so that when something fails in production, you can reconstruct exactly what happened without needing to reproduce it',
          'Adding feature flags to all services so they can be toggled without redeployment',
          'Running load tests against each individual service to find performance bottlenecks'
        ],
        correct: 1
      }
    ],
    tasks: [
      {
        title: 'Trace a Failure Across a 6-Service Chain',
        scenario:
          'Platform architecture (request flows left to right):\nAuth → Product Catalog → Cart → Payment → Order → Notification\n\nUser report:\n"I was charged $89 on my credit card. My bank shows a pending transaction. But I received no order confirmation email, my account shows no orders, and my cart was not cleared."\n\nPayment service logs show: "payment pay_xK92mN completed successfully for $89.00 at 14:32:01"',
        question:
          '1. Which services do you suspect caused the failure? Rank them by priority and explain why.\n2. How do you trace this failure if you have no centralized tracing tool (no Jaeger/Zipkin) — only per-service logs?\n3. What specific data/queries would you run in each suspected service?\n4. Write one end-to-end test case that would catch this exact failure before it reaches production.',
        placeholder: 'Think about where state is created and where it could be lost. Be systematic.',
        evalPrompt: 'You are a senior distributed systems engineer evaluating a failure trace analysis. The failure likely occurred between Payment and Order service (Order was not created despite successful payment), with Notification failing as a downstream consequence. Cart not clearing suggests the frontend listens for order confirmation. Score 0–10: correct identification of failure point (3 pts), practical investigation approach without centralized tracing (2 pts), specific service-level queries (2 pts), E2E test case quality (3 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'Test Strategy for a Monolith-to-Microservices Migration',
        scenario:
          'The engineering team is migrating a monolith to microservices over 3 months. During migration, both systems run simultaneously — some user traffic hits the monolith, some hits the new services. The cutover will be gradual (10% → 25% → 50% → 100%) via a feature flag.\n\nThe monolith handles: user auth, orders, payments, inventory, and notifications.',
        question:
          'What are the 5 biggest testing risks during this migration?\n\nFor each risk:\n- Why is it a risk?\n- How would you detect it?\n- What test or monitoring would mitigate it?\n\nThen describe how you would validate data consistency between the monolith and microservices during the parallel-run phase.',
        placeholder: 'Think about dual-write consistency, session state, traffic splitting edge cases, and rollback.',
        evalPrompt: 'You are a senior platform QA engineer evaluating a migration test strategy. Key risks: data consistency during dual-write, session/auth state portability, feature parity gaps (monolith behavior not replicated in services), rollback safety at each cutover percentage, and performance regression under split traffic. Score 0–10: identification and quality of 5 risks (5 pts), detection and mitigation quality (3 pts), data consistency validation strategy (2 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────
  // 7. AI IN QA
  // ─────────────────────────────────────────────────────
  {
    id: 7,
    domain: 'AI in QA',
    mcqs: [
      {
        q: 'You are testing an LLM-powered customer support chatbot that answers correctly 95% of the time in testing. Which critical risk does this metric alone NOT address?',
        options: [
          'Whether the bot handles common support questions correctly',
          'Whether API response latency meets the product\'s SLA',
          'Whether the bot could produce harmful, biased, or confidential-data-leaking outputs in rare but realistic edge cases that weren\'t in your test set',
          'Whether the integration with the support ticketing system works end-to-end'
        ],
        correct: 2
      },
      {
        q: 'What is "hallucination" in LLM systems, and why is it a QA concern that differs from bugs in traditional software?',
        options: [
          'When the model runs slowly — differs from traditional software because LLM inference is non-deterministic',
          'When the model returns an API error — differs because the error messages are less structured than traditional software errors',
          'When the model generates confident-sounding but factually incorrect information — differs because traditional software either gives the right answer or throws an error; an LLM can be confidently wrong with no signal that it has failed',
          'When the model produces different outputs for identical inputs — differs because traditional software is always deterministic'
        ],
        correct: 2
      },
      {
        q: 'When testing a new version of an AI model to see if it performs better than the previous version, which approach provides the most reliable evaluation?',
        options: [
          'Run the same unit tests used for traditional software and check that all pass',
          'Measure API response latency before and after — faster means better',
          'Evaluate against a labeled benchmark dataset and/or run an A/B test with real users measuring a defined success metric (e.g., task completion rate, user satisfaction score)',
          'Check that the model\'s output format and JSON schema remain unchanged'
        ],
        correct: 2
      }
    ],
    tasks: [
      {
        title: 'Design a Test Plan for an AI-Powered Feature',
        scenario:
          'Your product is adding a "Smart Summary" feature. It reads a user\'s last 50 support tickets and generates a 3-sentence summary shown to support agents before they respond. The feature uses an LLM API under the hood.\n\nExamples of what can go wrong:\n- Summary reveals PII from one user\'s tickets to a different agent\n- Summary is accurate but confidently includes false details\n- Summary takes 12 seconds to generate, timing out the agent\'s view\n- Summary works for users with 50 tickets but crashes for users with 0 tickets',
        question:
          'Design a complete test plan for this feature covering:\n1. Functional test cases (happy path + edge cases like 0 tickets, 1 ticket, non-English tickets)\n2. Safety and privacy risks — what could go wrong and how do you test for it?\n3. Performance requirements — what SLAs would you define?\n4. How would you evaluate summary quality at scale? You can\'t manually read 10,000 summaries.',
        placeholder: 'Cover all four areas. Be specific — not just "test edge cases" but which ones and how.',
        evalPrompt: 'You are a senior AI QA engineer evaluating a test plan for an LLM-powered feature. Score 0–10: functional test case coverage including 0/1/50+ tickets (2 pts), safety and privacy risk identification (PII leakage, hallucination, prompt injection, cross-user data) (3 pts), performance SLA definition (1 pt), automated quality evaluation strategy at scale (LLM-as-judge, human-labeled golden set, semantic similarity) (4 pts). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      },
      {
        title: 'AI in QA: Your Real Experience',
        scenario:
          'AI tools (Claude, ChatGPT, GitHub Copilot, etc.) are increasingly part of QA workflows — for writing test cases, generating test data, analyzing logs, writing scripts, reviewing PRs, and more.',
        question:
          'Answer all three parts honestly:\n\n1. How are you currently using AI in your QA work? Be specific: which tool, which task, and roughly what prompt or workflow do you use?\n\n2. Give one concrete example where AI helped you save real time or catch something you might have missed. OR: one example where AI gave you a wrong or misleading result and what that taught you.\n\n3. Where do you think AI should NOT replace a human QA engineer — and why? Give a specific scenario, not a general statement.',
        placeholder: 'Be honest and specific. We value critical thinking over enthusiasm.',
        evalPrompt: 'You are a senior QA practitioner evaluating a candidate\'s self-assessment of AI usage in QA. Score 0–10: specificity and credibility of current AI usage (3 pts) — vague answers score 0–1, specific workflow descriptions score 2–3; concrete example quality with real insight (3 pts); quality and specificity of where AI should NOT replace humans (3 pts) — "humans are needed for creativity" scores 1, specific scenarios like "exploratory testing for undefined behaviors" or "safety-critical system sign-off" score 3; overall honesty and self-awareness (1 pt). Return JSON: {"score": N, "feedback": "2–3 sentence summary"}.'
      }
    ]
  }
];

// Expose globally so app.js can access after questions.js loads
window.DOMAINS = DOMAINS;
