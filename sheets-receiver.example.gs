// ================================================================
//  QA Skill Check — Google Sheets Receiver
//  Spreadsheet : Starapps QA — Candidate Assessments
//  Script name : QA Skill Check Receiver
//
//  Setup:
//    1. Open the Google Sheet → Extensions → Apps Script
//    2. Paste this entire file, replacing any existing code
//    3. Deploy → New deployment → Web App
//       Execute as: Me | Who has access: Anyone
//    4. Copy the Web App URL → set as QA_SHEETS_ENDPOINT in Cloudflare Pages env vars
//
//  To update after code changes:
//    Deploy → Manage deployments → Edit → New version → Deploy
//    (URL stays the same — no need to update config)
// ================================================================

var SHEET_NAME = 'Submissions';

// Column headers — must stay in sync with FIELD_ORDER below (116 columns total)
var HEADERS = [
  // ── Candidate (5) ──────────────────────────────────────────────
  'Timestamp', 'Full Name', 'Email', 'Experience', 'Role',

  // ── Summary (7) ────────────────────────────────────────────────
  'MCQ Total (auto)', 'Task Score Total (AI)', 'Raw Total Score', 'Score /100',
  'Domains Submitted', 'Tampered?', 'Tab Switches',

  // ── Domain 0 : Manual Testing (10 MCQ · 0 tasks) (4) ───────────
  'MT – MCQ Score', 'MT – MCQ Detail (JSON)', 'MT – Time (s)', 'MT – Suspicious?',

  // ── Domain 1 : API Testing (3 MCQ · 2 tasks) (10) ──────────────
  'API – MCQ Score', 'API – MCQ Detail (JSON)',
  'API – Task 1', 'API – T1 AI Score', 'API – T1 AI Feedback',
  'API – Task 2', 'API – T2 AI Score', 'API – T2 AI Feedback',
  'API – Time (s)', 'API – Suspicious?',

  // ── Domain 2 : Back-End Testing (10) ───────────────────────────
  'BE – MCQ Score', 'BE – MCQ Detail (JSON)',
  'BE – Task 1', 'BE – T1 AI Score', 'BE – T1 AI Feedback',
  'BE – Task 2', 'BE – T2 AI Score', 'BE – T2 AI Feedback',
  'BE – Time (s)', 'BE – Suspicious?',

  // ── Domain 3 : DB Log Reading (10) ─────────────────────────────
  'DB – MCQ Score', 'DB – MCQ Detail (JSON)',
  'DB – Task 1', 'DB – T1 AI Score', 'DB – T1 AI Feedback',
  'DB – Task 2', 'DB – T2 AI Score', 'DB – T2 AI Feedback',
  'DB – Time (s)', 'DB – Suspicious?',

  // ── Domain 4 : Test Automation (10) ────────────────────────────
  'AUTO – MCQ Score', 'AUTO – MCQ Detail (JSON)',
  'AUTO – Task 1', 'AUTO – T1 AI Score', 'AUTO – T1 AI Feedback',
  'AUTO – Task 2', 'AUTO – T2 AI Score', 'AUTO – T2 AI Feedback',
  'AUTO – Time (s)', 'AUTO – Suspicious?',

  // ── Domain 5 : Root Cause Analysis (10) ────────────────────────
  'RCA – MCQ Score', 'RCA – MCQ Detail (JSON)',
  'RCA – Task 1', 'RCA – T1 AI Score', 'RCA – T1 AI Feedback',
  'RCA – Task 2', 'RCA – T2 AI Score', 'RCA – T2 AI Feedback',
  'RCA – Time (s)', 'RCA – Suspicious?',

  // ── Domain 6 : Complex Systems (10) ────────────────────────────
  'SYS – MCQ Score', 'SYS – MCQ Detail (JSON)',
  'SYS – Task 1', 'SYS – T1 AI Score', 'SYS – T1 AI Feedback',
  'SYS – Task 2', 'SYS – T2 AI Score', 'SYS – T2 AI Feedback',
  'SYS – Time (s)', 'SYS – Suspicious?',

  // ── Domain 7 : AI in QA (10) ────────────────────────────────────
  'AIQA – MCQ Score', 'AIQA – MCQ Detail (JSON)',
  'AIQA – Task 1', 'AIQA – T1 AI Score', 'AIQA – T1 AI Feedback',
  'AIQA – Task 2', 'AIQA – T2 AI Score', 'AIQA – T2 AI Feedback',
  'AIQA – Time (s)', 'AIQA – Suspicious?',

  // ── Domain 8 : QA Playground · 30 min (16) ─────────────────────
  'PG – MCQ Score', 'PG – MCQ Detail (JSON)',
  'PG – Task 1 (UI Bugs)', 'PG – T1 AI Score', 'PG – T1 AI Feedback',
  'PG – Task 2 (API Bugs)', 'PG – T2 AI Score', 'PG – T2 AI Feedback',
  'PG – Task 3 (Functional Bugs)', 'PG – T3 AI Score', 'PG – T3 AI Feedback',
  'PG – Task 4 (Other Bugs)', 'PG – T4 AI Score', 'PG – T4 AI Feedback',
  'PG – Time (s)', 'PG – Suspicious?',

  // ── Domain 9 : AI Prompting · 30 min · 0 MCQs · 4 tasks (14) ───
  'AIP – Task 1', 'AIP – T1 AI Score', 'AIP – T1 AI Feedback',
  'AIP – Task 2', 'AIP – T2 AI Score', 'AIP – T2 AI Feedback',
  'AIP – Task 3', 'AIP – T3 AI Score', 'AIP – T3 AI Feedback',
  'AIP – Task 4', 'AIP – T4 AI Score', 'AIP – T4 AI Feedback',
  'AIP – Time (s)', 'AIP – Suspicious?'
];

// Field keys — same order as HEADERS, maps directly to the flat JSON payload
var FIELD_ORDER = [
  // Candidate
  'timestamp', 'fullName', 'email', 'experience', 'role',

  // Summary
  'totalMcqScore', 'totalTaskScore', 'totalScore', 'scoreOutOf100',
  'totalDomains', 'tampered', 'tabSwitches',

  // Domain 0 — Manual Testing
  'domain_0_mcq_score', 'domain_0_mcq_answers', 'domain_0_time_secs', 'domain_0_suspicious',

  // Domain 1 — API Testing
  'domain_1_mcq_score', 'domain_1_mcq_answers',
  'domain_1_task_1', 'domain_1_task_1_score', 'domain_1_task_1_feedback',
  'domain_1_task_2', 'domain_1_task_2_score', 'domain_1_task_2_feedback',
  'domain_1_time_secs', 'domain_1_suspicious',

  // Domain 2 — Back-End Testing
  'domain_2_mcq_score', 'domain_2_mcq_answers',
  'domain_2_task_1', 'domain_2_task_1_score', 'domain_2_task_1_feedback',
  'domain_2_task_2', 'domain_2_task_2_score', 'domain_2_task_2_feedback',
  'domain_2_time_secs', 'domain_2_suspicious',

  // Domain 3 — DB Log Reading
  'domain_3_mcq_score', 'domain_3_mcq_answers',
  'domain_3_task_1', 'domain_3_task_1_score', 'domain_3_task_1_feedback',
  'domain_3_task_2', 'domain_3_task_2_score', 'domain_3_task_2_feedback',
  'domain_3_time_secs', 'domain_3_suspicious',

  // Domain 4 — Test Automation
  'domain_4_mcq_score', 'domain_4_mcq_answers',
  'domain_4_task_1', 'domain_4_task_1_score', 'domain_4_task_1_feedback',
  'domain_4_task_2', 'domain_4_task_2_score', 'domain_4_task_2_feedback',
  'domain_4_time_secs', 'domain_4_suspicious',

  // Domain 5 — Root Cause Analysis
  'domain_5_mcq_score', 'domain_5_mcq_answers',
  'domain_5_task_1', 'domain_5_task_1_score', 'domain_5_task_1_feedback',
  'domain_5_task_2', 'domain_5_task_2_score', 'domain_5_task_2_feedback',
  'domain_5_time_secs', 'domain_5_suspicious',

  // Domain 6 — Complex Systems
  'domain_6_mcq_score', 'domain_6_mcq_answers',
  'domain_6_task_1', 'domain_6_task_1_score', 'domain_6_task_1_feedback',
  'domain_6_task_2', 'domain_6_task_2_score', 'domain_6_task_2_feedback',
  'domain_6_time_secs', 'domain_6_suspicious',

  // Domain 7 — AI in QA
  'domain_7_mcq_score', 'domain_7_mcq_answers',
  'domain_7_task_1', 'domain_7_task_1_score', 'domain_7_task_1_feedback',
  'domain_7_task_2', 'domain_7_task_2_score', 'domain_7_task_2_feedback',
  'domain_7_time_secs', 'domain_7_suspicious',

  // Domain 8 — QA Playground
  'domain_8_mcq_score', 'domain_8_mcq_answers',
  'domain_8_task_1', 'domain_8_task_1_score', 'domain_8_task_1_feedback',
  'domain_8_task_2', 'domain_8_task_2_score', 'domain_8_task_2_feedback',
  'domain_8_task_3', 'domain_8_task_3_score', 'domain_8_task_3_feedback',
  'domain_8_task_4', 'domain_8_task_4_score', 'domain_8_task_4_feedback',
  'domain_8_time_secs', 'domain_8_suspicious',

  // Domain 9 — AI Prompting
  'domain_9_task_1', 'domain_9_task_1_score', 'domain_9_task_1_feedback',
  'domain_9_task_2', 'domain_9_task_2_score', 'domain_9_task_2_feedback',
  'domain_9_task_3', 'domain_9_task_3_score', 'domain_9_task_3_feedback',
  'domain_9_task_4', 'domain_9_task_4_score', 'domain_9_task_4_feedback',
  'domain_9_time_secs', 'domain_9_suspicious'
];

// ── Main entry point ──────────────────────────────────────────────
function doPost(e) {
  var TOKEN = 'YOUR_QA_TOKEN_HERE';
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.token !== TOKEN) {
      return ContentService
        .createTextOutput('Unauthorized')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet + header on first run
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      formatHeaderRow(sheet);
    }

    // Re-add header if sheet was manually cleared
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      formatHeaderRow(sheet);
    }

    // Build the row in the exact column order defined by FIELD_ORDER
    var row = FIELD_ORDER.map(function (key) {
      var val = data[key];
      if (val === undefined || val === null) return '';
      if (typeof val === 'boolean') return val ? 'YES' : 'NO';
      return val;
    });

    sheet.appendRow(row);

    // Highlight tampered or tab-heavy submissions in amber
    if (data.tampered || data.tabSwitches >= 3) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, HEADERS.length)
           .setBackground('#fff3cd');
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: health check (visit the Web App URL in browser to confirm live) ──
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'QA Skill Check Receiver' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Format the header row ─────────────────────────────────────────
function formatHeaderRow(sheet) {
  var range = sheet.getRange(1, 1, 1, HEADERS.length);
  range.setBackground('#09090b')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setFontSize(10);
  sheet.setFrozenRows(1);

  // Default width for all columns
  for (var i = 1; i <= HEADERS.length; i++) {
    sheet.setColumnWidth(i, 130);
  }

  // Domains 1–7: task blocks start at col 19, repeat every 10 cols
  // Per block: [task_answer(340), ai_score(80), ai_feedback(260), task_answer(340), ai_score(80), ai_feedback(260)]
  for (var d = 0; d < 7; d++) {
    var base = 19 + d * 10; // 1-indexed column of task_1 answer for domain d+1
    sheet.setColumnWidth(base,     340); // task 1 answer
    sheet.setColumnWidth(base + 1,  80); // task 1 AI score
    sheet.setColumnWidth(base + 2, 260); // task 1 AI feedback
    sheet.setColumnWidth(base + 3, 340); // task 2 answer
    sheet.setColumnWidth(base + 4,  80); // task 2 AI score
    sheet.setColumnWidth(base + 5, 260); // task 2 AI feedback
  }

  // Domain 8 (QA Playground): 4 tasks, starts at col 89
  var pg = 89;
  for (var t = 0; t < 4; t++) {
    sheet.setColumnWidth(pg + t * 3,     340); // task answer
    sheet.setColumnWidth(pg + t * 3 + 1,  80); // AI score
    sheet.setColumnWidth(pg + t * 3 + 2, 260); // AI feedback
  }

  // Domain 9 (AI Prompting): 4 tasks, starts at col 103
  var aip = 103;
  for (var t = 0; t < 4; t++) {
    sheet.setColumnWidth(aip + t * 3,     340); // task answer
    sheet.setColumnWidth(aip + t * 3 + 1,  80); // AI score
    sheet.setColumnWidth(aip + t * 3 + 2, 260); // AI feedback
  }
}
