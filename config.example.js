/**
 * QA Skill Check — Configuration Template
 *
 * Copy this file to config.js and fill in your values.
 * config.js is gitignored — this template is what gets committed.
 *
 * SHEETS_ENDPOINT : Deployed Google Apps Script Web App URL.
 *                   Script → Deploy → New deployment → Web app → Execute as Me → Anyone.
 *
 * AI_EVAL_ENDPOINT: URL of your Cloudflare Worker that proxies the Claude API.
 *                   Store CLAUDE_API_KEY and QA_TOKEN as Worker secrets — never here.
 *
 * QA_TOKEN        : Shared secret sent with every submission.
 *                   Must match the QA_TOKEN secret set on the Cloudflare Worker
 *                   and the TOKEN constant in the Google Apps Script.
 *                   Generate with: openssl rand -hex 20
 */
window.QA_CONFIG = {
  sheetsEndpoint:  'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  aiEvalEndpoint:  'https://your-worker.your-domain.workers.dev',
  qaToken:         'qa-sk-REPLACE_WITH_YOUR_TOKEN'
};
