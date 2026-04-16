/**
 * QA Skill Check — Cloudflare Worker
 *
 * Receives task answers from the assessment, calls Claude API to score them,
 * and returns scores back to the frontend.
 *
 * Environment variables (set as Cloudflare Worker secrets):
 *   CLAUDE_API_KEY  →  Anthropic API key (sk-ant-...)
 *   QA_TOKEN        →  Shared secret — must match qaToken in config.js
 *                      Set with: wrangler secret put QA_TOKEN
 *
 * Expected request:
 *   POST /
 *   Headers: X-QA-Token: <token>
 *   Body: { candidateEmail: "...", tasks: [{ domain, taskTitle, evalPrompt, answer }] }
 *
 * Response:
 *   { candidateEmail: "...", scores: [{ domain, taskTitle, score, feedback }] }
 */

const MAX_TASKS        = 20;    /* max tasks per submission (9 domains × ~2 tasks = 18 max) */
const MAX_ANSWER_LEN   = 8000;  /* max chars per answer — prevents prompt-stuffing          */
const MODEL            = 'claude-haiku-4-5-20251001';

export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return cors('', 204);
    }

    // ── Health check ──────────────────────────────────────────
    if (request.method === 'GET') {
      return cors(JSON.stringify({ status: 'ok', service: 'QA Eval Worker' }), 200);
    }

    if (request.method !== 'POST') {
      return cors(JSON.stringify({ error: 'POST only' }), 405);
    }

    // ── Token gate — reject unknown callers ───────────────────
    const token = request.headers.get('X-QA-Token') || '';
    if (!env.QA_TOKEN || token !== env.QA_TOKEN) {
      return cors(JSON.stringify({ error: 'Unauthorized' }), 401);
    }

    // ── Parse body ────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return cors(JSON.stringify({ error: 'Invalid JSON' }), 400);
    }

    const { candidateEmail, tasks } = body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return cors(JSON.stringify({ error: 'tasks array required' }), 400);
    }

    // ── Input validation — prevent abuse ──────────────────────
    if (tasks.length > MAX_TASKS) {
      return cors(JSON.stringify({ error: 'Too many tasks' }), 400);
    }

    if (!env.CLAUDE_API_KEY) {
      return cors(JSON.stringify({ error: 'API key not configured' }), 500);
    }

    // ── Evaluate all tasks in parallel ────────────────────────
    const scores = await Promise.all(
      tasks.map(task => evaluate(task, env.CLAUDE_API_KEY))
    );

    return cors(JSON.stringify({ candidateEmail, scores }), 200);
  }
};

// ── Score one task via Claude ─────────────────────────────────
async function evaluate(task, apiKey) {
  const { domain, taskTitle, evalPrompt, answer } = task;

  // Skip if no meaningful answer given
  if (!answer || answer.trim().length < 15) {
    return { domain, taskTitle, score: 0, feedback: 'No answer provided.' };
  }

  // Truncate oversized answers — prevents token abuse
  const safeAnswer = answer.trim().slice(0, MAX_ANSWER_LEN);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 300,
        system:     evalPrompt,
        messages: [{
          role:    'user',
          content: `Task: ${taskTitle}\n\nCandidate answer:\n${safeAnswer}`
        }]
      })
    });

    if (!res.ok) {
      console.error('Claude error', res.status, await res.text());
      return { domain, taskTitle, score: null, feedback: 'Evaluation unavailable.' };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Extract the JSON object Claude returns: { score: N, feedback: "..." }
    // Use lastIndexOf('}') so the match spans the full object even if the
    // feedback text contains '{' or '}' characters.
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return {
          domain,
          taskTitle,
          score:    typeof parsed.score    === 'number' ? parsed.score    : null,
          feedback: typeof parsed.feedback === 'string' ? parsed.feedback : text
        };
      } catch { /* fall through */ }
    }

    return { domain, taskTitle, score: null, feedback: text };

  } catch (err) {
    console.error('Worker error:', err);
    return { domain, taskTitle, score: null, feedback: 'Evaluation error.' };
  }
}

// ── CORS wrapper ──────────────────────────────────────────────
function cors(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-QA-Token'
    }
  });
}
