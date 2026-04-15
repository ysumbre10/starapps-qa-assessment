/**
 * QA Skill Check — Assessment Engine
 *
 * Responsibilities:
 *  - Load tasks from tasks.json
 *  - Render one task at a time
 *  - Run per-task 10-minute countdown
 *  - Auto-submit on timer expiry
 *  - Submit answers to Google Sheets via Apps Script Web App
 *  - Navigate to thank-you page when all tasks are done
 *
 * Google Sheets integration:
 *  Replace SHEETS_ENDPOINT below with your deployed Apps Script Web App URL.
 */

const SHEETS_ENDPOINT = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
const TASK_TIME_LIMIT = 600; // 10 minutes in seconds
const RING_CIRCUMFERENCE = 2 * Math.PI * 23; // r=23 → ~144.51

// ── State ──────────────────────────────────────────────────────────────────
let tasks = [];
let currentIndex = 0;
let timerInterval = null;
let secondsLeft = TASK_TIME_LIMIT;
let taskStartTime = null;
let candidate = null;
let responses = {};
let timings = {};

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Guard: must have candidate data
  const raw = sessionStorage.getItem('qa_candidate');
  if (!raw) {
    window.location.href = 'index.html';
    return;
  }

  candidate = JSON.parse(raw);
  responses = JSON.parse(sessionStorage.getItem('qa_responses') || '{}');
  timings = JSON.parse(sessionStorage.getItem('qa_timings') || '{}');
  currentIndex = parseInt(sessionStorage.getItem('qa_current_task') || '0', 10);

  document.getElementById('headerCandidate').textContent = candidate.fullName;

  // Load tasks
  try {
    const res = await fetch('tasks.json');
    tasks = await res.json();
  } catch (err) {
    console.error('Failed to load tasks.json', err);
    alert('Failed to load assessment tasks. Please refresh the page.');
    return;
  }

  // If all tasks already done, go to thank-you
  if (currentIndex >= tasks.length) {
    window.location.href = 'thankyou.html';
    return;
  }

  renderTask(currentIndex);
});

// ── Render Task ────────────────────────────────────────────────────────────
function renderTask(index) {
  const task = tasks[index];

  // Update progress
  const progress = (index / tasks.length) * 100;
  document.getElementById('progressFill').style.width = progress + '%';
  document.getElementById('progressLabel').textContent = `Task ${index + 1} of ${tasks.length}`;
  document.getElementById('progressDomain').textContent = task.domain;

  // Task content
  document.getElementById('taskDomain').textContent = task.domain;
  document.getElementById('taskTitle').textContent = task.title;
  document.getElementById('taskScenario').textContent = task.scenario;

  // Render question with line breaks preserved
  const qEl = document.getElementById('taskQuestion');
  qEl.innerHTML = task.question.split('\n').map(line => {
    line = line.trim();
    if (!line) return '';
    return `<p style="margin-bottom:6px;color:var(--text-muted);font-size:14px;">${escapeHtml(line)}</p>`;
  }).join('');

  // Answer box
  const answerBox = document.getElementById('answerBox');
  answerBox.value = '';
  answerBox.placeholder = task.placeholder || 'Type your answer here...';
  answerBox.focus();

  document.getElementById('charCount').textContent = '0';

  // Char counter
  answerBox.oninput = function () {
    document.getElementById('charCount').textContent = this.value.length.toLocaleString();
  };

  // Set auto-submit time display
  const endTime = new Date(Date.now() + TASK_TIME_LIMIT * 1000);
  document.getElementById('autoSubmitAt').textContent = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Start timer
  startTimer(task.timeLimit || TASK_TIME_LIMIT);

  // Submit button
  document.getElementById('submitBtn').onclick = () => submitTask(false);
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer(durationSecs) {
  clearInterval(timerInterval);
  secondsLeft = durationSecs;
  taskStartTime = Date.now();

  updateTimerDisplay();

  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay();

    if (secondsLeft === 120) {
      // 2-minute warning
      document.getElementById('autosubmitNotice').style.display = 'flex';
    }

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      submitTask(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const el = document.getElementById('timerDisplay');
  const ring = document.getElementById('timerRing');
  const totalTime = tasks[currentIndex]?.timeLimit || TASK_TIME_LIMIT;
  const fraction = secondsLeft / totalTime;

  el.textContent = display;

  // Ring progress
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  ring.style.strokeDashoffset = offset;

  // Color states
  el.classList.remove('warning', 'danger');
  ring.classList.remove('warning', 'danger');

  if (secondsLeft <= 60) {
    el.classList.add('danger');
    ring.classList.add('danger');
  } else if (secondsLeft <= 120) {
    el.classList.add('warning');
    ring.classList.add('warning');
  }
}

// ── Submit ─────────────────────────────────────────────────────────────────
async function submitTask(isAutoSubmit) {
  clearInterval(timerInterval);

  const task = tasks[currentIndex];
  const answer = document.getElementById('answerBox').value.trim();
  const timeUsed = Math.round((Date.now() - taskStartTime) / 1000);

  // Disable submit button
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  if (isAutoSubmit) {
    document.getElementById('autosubmitNotice').style.display = 'none';
    showAutoSubmitFlash();
  }

  // Record
  responses[`task_${task.id}`] = answer || '(no answer — auto-submitted)';
  timings[`task_${task.id}_secs`] = timeUsed;

  sessionStorage.setItem('qa_responses', JSON.stringify(responses));
  sessionStorage.setItem('qa_timings', JSON.stringify(timings));

  // If last task, submit everything to Sheets and go to thank-you
  if (currentIndex >= tasks.length - 1) {
    await submitAllToSheets();
    window.location.href = 'thankyou.html';
    return;
  }

  // Advance
  currentIndex++;
  sessionStorage.setItem('qa_current_task', String(currentIndex));

  // Brief transition
  const card = document.getElementById('taskCard');
  card.style.opacity = '0.4';
  card.style.transform = 'translateY(8px)';
  card.style.transition = 'opacity 0.25s, transform 0.25s';

  setTimeout(() => {
    document.getElementById('autosubmitNotice').style.display = 'none';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
    btn.disabled = false;
    btn.innerHTML = 'Submit &amp; Next Task →';
    renderTask(currentIndex);
  }, 320);
}

// ── Google Sheets Submission ───────────────────────────────────────────────
async function submitAllToSheets() {
  if (SHEETS_ENDPOINT === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    console.warn('Google Sheets endpoint not configured. Skipping remote save.');
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...candidate,
    ...responses,
    ...timings,
    completionPct: Math.round((Object.keys(responses).length / tasks.length) * 100)
  };

  try {
    await fetch(SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires no-cors
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Failed to submit to Google Sheets:', err);
    // Don't block the user — still navigate to thank-you
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
  banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:999;max-width:420px;width:90%;animation:fadeIn 0.3s ease;';
  banner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>Time's up — task auto-submitted.</span>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3000);
}

// Prevent accidental navigation away mid-assessment
window.addEventListener('beforeunload', (e) => {
  if (currentIndex < tasks.length && tasks.length > 0) {
    e.preventDefault();
  }
});
