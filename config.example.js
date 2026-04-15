/**
 * QA Skill Check — Configuration Template
 *
 * Copy this file to config.js and fill in your values.
 * config.js is gitignored — this template is what gets committed.
 *
 * SHEETS_ENDPOINT : Deployed Google Apps Script Web App URL.
 *                   Script → Deploy → New deployment → Web app → Execute as Me → Anyone.
 *
 * AI_EVAL_ENDPOINT: URL of your serverless function (Vercel / Cloudflare Worker / etc.)
 *                   that receives { candidateEmail, tasks: [{domain, taskTitle, evalPrompt, answer}] }
 *                   and proxies to the Claude API. Store your Claude API key there — never here.
 */
window.QA_CONFIG = {
  sheetsEndpoint:  'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  aiEvalEndpoint:  'https://your-worker.your-domain.workers.dev/eval'
};
