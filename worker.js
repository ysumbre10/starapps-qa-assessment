/**
 * QA Skill Check — Cloudflare Worker
 *
 * Receives task answers from the assessment, calls Claude API to score them,
 * and returns scores back to the frontend.
 *
 * Environment variable required (set in Cloudflare dashboard):
 *   CLAUDE_API_KEY  →  your Anthropic API key (sk-ant-...)
 *
 * Expected request body:
 *   POST /eval
 *   { candidateEmail: "...", tasks: [{ domain, taskTitle, evalPrompt, answer }] }
 *
 * Response:
 *   { candidateEmail: "...", scores: [{ domain, taskTitle, score, feedback }] }
 */

export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return cors('', 204);
    }

    if (request.method !== 'POST') {
      return cors(JSON.stringify({ error: 'POST only' }), 405);
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

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system:     evalPrompt,
        messages: [{
          role:    'user',
          content: `Task: ${taskTitle}\n\nCandidate answer:\n${answer}`
        }]
      })
    });

    if (!res.ok) {
      console.error('Claude error', res.status, await res.text());
      return { domain, taskTitle, score: null, feedback: 'Evaluation unavailable.' };
    }

    const data  = await res.json();
    const text  = data.content?.[0]?.text || '';

    // Extract the JSON object Claude returns: { score: N, feedback: "..." }
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
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
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type'
    }
  });
}
