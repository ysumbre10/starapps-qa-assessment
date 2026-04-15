/**
 * QA Skill Check — Assessment Engine (v2)
 *
 * Format per domain: 3 MCQs + 2 open tasks, 10-minute timer for all 5 items.
 * MCQs: auto-graded client-side.
 * Tasks: submitted to Google Sheets + optionally evaluated via Claude API proxy.
 *
 * Setup:
 *  1. Replace SHEETS_ENDPOINT with your deployed Google Apps Script Web App URL.
 *  2. (Optional) Replace AI_EVAL_ENDPOINT with a serverless function URL that
 *     proxies to the Claude API and returns { scores: [{score, feedback}, ...] }.
 */

// DOMAINS is defined in questions.js, loaded before this script in assessment.html
// eslint-disable-next-line no-undef
const DOMAINS = /** @type {any[]} */ (window.DOMAINS);

const SHEETS_ENDPOINT  = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
const AI_EVAL_ENDPOINT = 'YOUR_AI_EVAL_ENDPOINT_HERE'; // optional

const DOMAIN_TIME_LIMIT = 600; // 10 minutes per domain
const RING_CIRCUMFERENCE = 2 * Math.PI * 23;

// ── State ──────────────────────────────────────────────────────────────────
let currentDomainIndex = 0;
let timerInterval = null;
let secondsLeft = DOMAIN_TIME_LIMIT;
let domainStartTime = null;
let candidate = null;
let allResponses = {};   // { domain_1: { mcqs: [0,2,1], tasks: ["...", "..."] }, ... }
let allTimings  = {};    // { domain_1_secs: 342, ... }
let mcqSelections = [];  // current domain's selected option indices

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('qa_candidate');
  if (!raw) { window.location.href = 'index.html'; return; }

  candidate = JSON.parse(raw);
  allResponses = JSON.parse(sessionStorage.getItem('qa_responses') || '{}');
  allTimings   = JSON.parse(sessionStorage.getItem('qa_timings')   || '{}');
  currentDomainIndex = parseInt(sessionStorage.getItem('qa_current_task') || '0', 10);

  document.getElementById('headerCandidate').textContent = candidate.fullName;

  if (currentDomainIndex >= DOMAINS.length) {
    window.location.href = 'thankyou.html';
    return;
  }

  renderDomain(currentDomainIndex);
});

// ── Render Domain ──────────────────────────────────────────────────────────
function renderDomain(index) {
  const domain = DOMAINS[index];
  mcqSelections = new Array(domain.mcqs.length).fill(null);

  // Progress
  const pct = (index / DOMAINS.length) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `Domain ${index + 1} of ${DOMAINS.length}`;
  document.getElementById('progressDomain').textContent = domain.domain;

  // Domain header
  document.getElementById('domainBadge').textContent = domain.domain;
  document.getElementById('domainTitle').textContent = domain.domain;

  // ── Render MCQs ──
  const mcqContainer = document.getElementById('mcqContainer');
  mcqContainer.innerHTML = '';

  domain.mcqs.forEach((mcq, qi) => {
    const block = document.createElement('div');
    block.className = 'mcq-block';
    block.dataset.qi = qi;

    const qNum = document.createElement('div');
    qNum.className = 'mcq-qnum';
    qNum.textContent = `Q${qi + 1}`;

    const qText = document.createElement('p');
    qText.className = 'mcq-question';
    qText.textContent = mcq.q;

    const options = document.createElement('div');
    options.className = 'mcq-options';

    mcq.options.forEach((opt, oi) => {
      const label = document.createElement('label');
      label.className = 'mcq-option';
      label.dataset.qi = qi;
      label.dataset.oi = oi;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `mcq_${qi}`;
      radio.value = oi;
      radio.addEventListener('change', () => {
        mcqSelections[qi] = oi;
        // Highlight selected
        options.querySelectorAll('.mcq-option').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
      });

      const optText = document.createElement('span');
      optText.textContent = opt;

      const marker = document.createElement('span');
      marker.className = 'mcq-marker';
      marker.textContent = String.fromCharCode(65 + oi); // A B C D

      label.appendChild(radio);
      label.appendChild(marker);
      label.appendChild(optText);
      options.appendChild(label);
    });

    block.appendChild(qNum);
    block.appendChild(qText);
    block.appendChild(options);
    mcqContainer.appendChild(block);
  });

  // ── Render Tasks ──
  const taskContainer = document.getElementById('taskContainer');
  taskContainer.innerHTML = '';

  domain.tasks.forEach((task, ti) => {
    const block = document.createElement('div');
    block.className = 'task-block';

    const header = document.createElement('div');
    header.className = 'task-block-header';
    header.innerHTML = `
      <span class="task-block-num">Task ${ti + 1}</span>
      <span class="task-block-title">${escapeHtml(task.title)}</span>
    `;

    const scenario = document.createElement('div');
    scenario.className = 'scenario-block';
    scenario.textContent = task.scenario;

    const questionLabel = document.createElement('div');
    questionLabel.className = 'task-question-label';
    questionLabel.textContent = 'Your Task';

    const questionText = document.createElement('div');
    questionText.className = 'task-question-text';
    questionText.textContent = task.question;

    const answerLabel = document.createElement('span');
    answerLabel.className = 'answer-label';
    answerLabel.textContent = 'Your Answer';

    const textarea = document.createElement('textarea');
    textarea.className = 'answer-textarea';
    textarea.id = `task_answer_${ti}`;
    textarea.placeholder = task.placeholder || 'Type your answer here...';
    textarea.spellcheck = true;

    const charCount = document.createElement('div');
    charCount.className = 'char-count';
    charCount.id = `char_${ti}`;
    charCount.textContent = '0 characters';

    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length.toLocaleString() + ' characters';
    });

    block.appendChild(header);
    block.appendChild(scenario);
    block.appendChild(questionLabel);
    block.appendChild(questionText);
    block.appendChild(answerLabel);
    block.appendChild(textarea);
    block.appendChild(charCount);
    taskContainer.appendChild(block);
  });

  // Auto-submit time label
  const endTime = new Date(Date.now() + DOMAIN_TIME_LIMIT * 1000);
  document.getElementById('autoSubmitAt').textContent = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Wire submit button
  document.getElementById('submitBtn').onclick = () => submitDomain(false);

  // Start timer
  startTimer();
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  secondsLeft = DOMAIN_TIME_LIMIT;
  domainStartTime = Date.now();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay();
    if (secondsLeft === 120) {
      document.getElementById('autosubmitNotice').style.display = 'flex';
    }
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      submitDomain(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const el   = document.getElementById('timerDisplay');
  const ring = document.getElementById('timerRing');
  const fraction = secondsLeft / DOMAIN_TIME_LIMIT;

  el.textContent = display;
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);

  el.classList.remove('warning', 'danger');
  ring.classList.remove('warning', 'danger');

  if (secondsLeft <= 60)       { el.classList.add('danger');  ring.classList.add('danger');  }
  else if (secondsLeft <= 120) { el.classList.add('warning'); ring.classList.add('warning'); }
}

// ── Submit ─────────────────────────────────────────────────────────────────
async function submitDomain(isAutoSubmit) {
  clearInterval(timerInterval);

  const domain = DOMAINS[currentDomainIndex];
  const timeUsed = Math.round((Date.now() - domainStartTime) / 1000);

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  if (isAutoSubmit) showAutoSubmitFlash();

  // Collect MCQ answers
  const mcqAnswers = mcqSelections.map((sel, qi) => ({
    selected: sel,
    correct: domain.mcqs[qi].correct,
    isCorrect: sel === domain.mcqs[qi].correct
  }));

  // Collect task answers
  const taskAnswers = domain.tasks.map((_, ti) => {
    const el = document.getElementById(`task_answer_${ti}`);
    return el ? el.value.trim() : '';
  });

  // Score MCQs
  const mcqScore = mcqAnswers.filter(a => a.isCorrect).length;

  // Store
  const key = `domain_${domain.id}`;
  allResponses[key] = {
    domainName: domain.domain,
    mcqAnswers,
    mcqScore,
    taskAnswers
  };
  allTimings[`${key}_secs`] = timeUsed;

  sessionStorage.setItem('qa_responses', JSON.stringify(allResponses));
  sessionStorage.setItem('qa_timings',   JSON.stringify(allTimings));

  // Last domain → submit everything and go to thank-you
  if (currentDomainIndex >= DOMAINS.length - 1) {
    await submitAllToSheets();
    window.location.href = 'thankyou.html';
    return;
  }

  // Advance
  currentDomainIndex++;
  sessionStorage.setItem('qa_current_task', String(currentDomainIndex));

  // Transition
  const card = document.getElementById('assessmentCard');
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  card.style.transition = 'opacity 0.25s, transform 0.25s';

  setTimeout(() => {
    document.getElementById('autosubmitNotice').style.display = 'none';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
    btn.disabled = false;
    btn.innerHTML = 'Submit &amp; Next Domain →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderDomain(currentDomainIndex);
  }, 320);
}

// ── Google Sheets + AI Eval Submission ─────────────────────────────────────
async function submitAllToSheets() {
  // Flatten all responses for the sheet
  const flat = {
    timestamp: new Date().toISOString(),
    fullName:    candidate.fullName,
    email:       candidate.email,
    experience:  candidate.experience,
    role:        candidate.role,
    domain:      candidate.domain,
    linkedin:    candidate.linkedin || '',
    totalMcqScore: 0,
    totalDomains: DOMAINS.length
  };

  let totalMcq = 0;

  DOMAINS.forEach(d => {
    const key = `domain_${d.id}`;
    const resp = allResponses[key] || {};
    flat[`${key}_mcq_score`]   = resp.mcqScore ?? 0;
    flat[`${key}_mcq_answers`] = JSON.stringify(resp.mcqAnswers ?? []);
    flat[`${key}_task_1`]      = resp.taskAnswers?.[0] ?? '';
    flat[`${key}_task_2`]      = resp.taskAnswers?.[1] ?? '';
    flat[`${key}_time_secs`]   = allTimings[`${key}_secs`] ?? 0;
    totalMcq += resp.mcqScore ?? 0;
  });

  flat.totalMcqScore = totalMcq;

  // Submit to Sheets
  if (SHEETS_ENDPOINT !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    try {
      await fetch(SHEETS_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flat)
      });
    } catch (err) {
      console.error('Sheets submission failed:', err);
    }
  }

  // Optional: AI task evaluation
  if (AI_EVAL_ENDPOINT !== 'YOUR_AI_EVAL_ENDPOINT_HERE') {
    const evalPayload = DOMAINS.map(d => {
      const key = `domain_${d.id}`;
      const resp = allResponses[key] || {};
      return d.tasks.map((task, ti) => ({
        domain: d.domain,
        taskTitle: task.title,
        evalPrompt: task.evalPrompt,
        answer: resp.taskAnswers?.[ti] ?? ''
      }));
    }).flat();

    try {
      const evalRes = await fetch(AI_EVAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateEmail: candidate.email, tasks: evalPayload })
      });
      if (evalRes.ok) {
        const evalData = await evalRes.json();
        sessionStorage.setItem('qa_ai_scores', JSON.stringify(evalData));
      }
    } catch (err) {
      console.error('AI evaluation failed:', err);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAutoSubmitFlash() {
  const banner = document.createElement('div');
  banner.className = 'notice notice-danger';
  banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:999;max-width:440px;width:90%;';
  banner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>Time's up — domain auto-submitted.</span>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3500);
}

window.addEventListener('beforeunload', (e) => {
  if (currentDomainIndex < DOMAINS.length && DOMAINS.length > 0) {
    e.preventDefault();
  }
});
