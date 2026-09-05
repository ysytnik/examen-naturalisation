const PASS_THRESHOLD = 0.8;
const LETTERS = ['A', 'B', 'C', 'D'];
const THEME_LABELS = {
  'République': 'Principes et valeurs',
  'Principes et valeurs de la République française': 'Principes et valeurs',
  'Laïcité et République': 'Laïcité',
  'Institutions': 'Institutions',
  'Système institutionnel et politique': 'Institutions',
  'Union européenne': 'Union européenne',
  'Droits et devoirs': 'Droits et devoirs',
  'Histoire, géographie et culture': 'Histoire & culture',
  'Histoire et Valeurs': 'Histoire & valeurs',
  'Culture': 'Culture',
  'Vivre dans la société française': 'Vivre en France',
};

let allQuestions = [];
let session = { mode: '', questions: [], index: 0, answers: [], isExam: false };
let initialized = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showError(msg) {
  const status = document.getElementById('offline-status');
  if (status) {
    status.textContent = 'Erreur : ' + msg;
    status.className = 'offline-status offline';
  }
  const grid = document.querySelector('.mode-grid');
  if (grid) grid.innerHTML = '<p style="color:#ef4444">Erreur de chargement des questions.</p>';
}

function safeStorageGet(key, fallback) {
  try { return localStorage.getItem(key); } catch (e) { return fallback; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* iOS file:// may block storage */ }
}

function init() {
  if (initialized) return;
  initialized = true;

  try {
    allQuestions = window.QUESTIONS_DATA || [];
    if (!allQuestions.length) throw new Error('questions introuvables');
    populateThemes();
    renderPersistentStats();
    registerSW();
    updateOfflineStatus();
  } catch (e) {
    console.error(e);
    showError(e.message || 'chargement impossible');
    return;
  }

  $$('.mode-btn').forEach((btn) => btn.addEventListener('click', () => startSession(btn.dataset.mode)));
  $('#btn-quit').addEventListener('click', () => { if (confirm('Quitter ?')) showScreen('home'); });
  $('#btn-next').addEventListener('click', nextQuestion);
  $('#btn-finish').addEventListener('click', showResults);
  $('#btn-retry').addEventListener('click', () => startSession(session.mode));
  $('#btn-home').addEventListener('click', () => showScreen('home'));
}

function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

function populateThemes() {
  const select = $('#theme-select');
  if (!select) return;
  select.length = 1;
  [...new Set(allQuestions.map((q) => q.t))].sort().forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = THEME_LABELS[t] || t;
    select.appendChild(opt);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startSession(mode) {
  const themeFilter = $('#theme-select').value;
  let pool = themeFilter ? allQuestions.filter((q) => q.t === themeFilter) : [...allQuestions];
  if (pool.length < 5) { alert('Pas assez de questions pour ce thème.'); return; }

  let count, isExam = false;
  if (mode === 'training') { count = Math.min(20, pool.length); }
  else if (mode === 'training-all') { count = pool.length; }
  else if (mode === 'exam-20') { count = Math.min(20, pool.length); isExam = true; }
  else { count = Math.min(40, pool.length); isExam = true; }

  session = { mode, questions: shuffle(pool).slice(0, count), index: 0, answers: [], isExam };
  showScreen('quiz');
  renderQuestion();
}

function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
  if (name === 'home') renderPersistentStats();
}

function renderQuestion() {
  const q = session.questions[session.index];
  const total = session.questions.length;
  $('#progress-bar').style.width = `${(session.index / total) * 100}%`;
  $('#progress-text').textContent = `${session.index + 1} / ${total}`;
  $('#theme-badge').textContent = THEME_LABELS[q.t] || q.t;
  $('#question-text').textContent = q.q;
  $('#options').innerHTML = '';
  q.o.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="letter">${LETTERS[i]}</span><span>${text}</span>`;
    btn.addEventListener('click', () => selectAnswer(i));
    $('#options').appendChild(btn);
  });
  $('#feedback').classList.add('hidden');
  $('#btn-next').classList.add('hidden');
  $('#btn-finish').classList.add('hidden');
}

function selectAnswer(choice) {
  const q = session.questions[session.index];
  const isCorrect = choice === q.a;
  $$('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.a) btn.classList.add('correct');
    else if (i === choice && !isCorrect) btn.classList.add('wrong');
    else btn.classList.add('dimmed');
  });
  session.answers.push({ questionIndex: session.index, choice, correct: isCorrect, question: q });

  if (session.isExam) {
    setTimeout(() => session.index >= session.questions.length - 1 ? showResults() : nextQuestion(), 400);
    return;
  }

  const header = $('#feedback-header');
  $('#feedback').classList.remove('hidden');
  if (isCorrect) {
    header.textContent = '✓ Bonne réponse !';
    header.className = 'feedback-header correct';
  } else {
    header.textContent = `✗ Mauvaise réponse — ${LETTERS[q.a]} : ${q.o[q.a]}`;
    header.className = 'feedback-header wrong';
  }
  $('#explanation').textContent = q.r || '';
  (session.index >= session.questions.length - 1 ? $('#btn-finish') : $('#btn-next')).classList.remove('hidden');
}

function nextQuestion() {
  session.index++;
  if (session.index >= session.questions.length) showResults();
  else renderQuestion();
}

function showResults() {
  const total = session.answers.length;
  const correct = session.answers.filter((a) => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = pct >= PASS_THRESHOLD * 100;
  const circle = $('#score-circle');
  circle.className = `score-circle ${passed ? 'pass' : 'fail'}`;
  $('#score-value').textContent = `${pct}%`;
  $('#score-label').textContent = `${correct} / ${total}`;

  if (session.isExam) {
    const needed = Math.ceil(total * PASS_THRESHOLD);
    $('#results-title').textContent = passed ? '🎉 Examen réussi !' : 'Examen non validé';
    $('#results-subtitle').textContent = passed
      ? `${correct}/${total} (minimum : ${needed})`
      : `${correct}/${total}. Minimum : ${needed} (${PASS_THRESHOLD * 100}%)`;
  } else {
    $('#results-title').textContent = 'Session terminée';
    $('#results-subtitle').textContent = `${correct} bonnes réponses sur ${total}`;
  }

  $('#stats-grid').innerHTML = `
    <div class="stat-card good"><div class="val">${correct}</div><div class="lbl">Correctes</div></div>
    <div class="stat-card bad"><div class="val">${total - correct}</div><div class="lbl">Incorrectes</div></div>
    <div class="stat-card"><div class="val">${total}</div><div class="lbl">Total</div></div>`;

  renderThemeBreakdown();
  renderReview();
  saveStats(correct, total, session.isExam, passed);
  showScreen('results');
}

function renderThemeBreakdown() {
  const byTheme = {};
  session.answers.forEach((a) => {
    const t = a.question.t;
    if (!byTheme[t]) byTheme[t] = { correct: 0, total: 0 };
    byTheme[t].total++;
    if (a.correct) byTheme[t].correct++;
  });
  const entries = Object.entries(byTheme).sort((a, b) => a[0].localeCompare(b[0]));
  $('#theme-breakdown').innerHTML = entries.length
    ? '<h3>Par thème</h3>' + entries.map(([theme, s]) => {
        const pct = Math.round((s.correct / s.total) * 100);
        const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
        return `<div class="theme-row"><span class="name">${THEME_LABELS[theme] || theme}</span>
          <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${color}"></div></div>
          <span class="pct">${s.correct}/${s.total}</span></div>`;
      }).join('')
    : '';
}

function renderReview() {
  $('#review-list').innerHTML = session.answers.map((a, i) => {
    const q = a.question;
    return `<div class="review-item ${a.correct ? 'correct-item' : 'wrong-item'}">
      <div class="q-num">Q${i + 1} · ${THEME_LABELS[q.t] || q.t}</div>
      <div class="q-text">${q.q}</div>
      <div class="ans-line">Votre réponse : <strong>${LETTERS[a.choice]} — ${q.o[a.choice]}</strong></div>
      ${!a.correct ? `<div class="ans-line">Bonne réponse : <strong>${LETTERS[q.a]} — ${q.o[q.a]}</strong></div>` : ''}
      ${q.r ? `<div class="ans-line" style="margin-top:0.375rem">${q.r}</div>` : ''}
    </div>`;
  }).join('');
}

function saveStats(correct, total, isExam, passed) {
  try {
    const stats = JSON.parse(safeStorageGet('civique_stats', '{"sessions":[],"totalCorrect":0,"totalQuestions":0,"examsPassed":0,"examsTotal":0}'));
    stats.sessions.push({ date: new Date().toISOString(), mode: session.mode, correct, total, passed: isExam ? passed : null });
    stats.totalCorrect += correct;
    stats.totalQuestions += total;
    if (isExam) { stats.examsTotal++; if (passed) stats.examsPassed++; }
    stats.sessions = stats.sessions.slice(-50);
    safeStorageSet('civique_stats', JSON.stringify(stats));
  } catch (e) { /* ignore storage errors offline */ }
}

function renderPersistentStats() {
  const el = $('#stats-summary');
  if (!el) return;
  let stats = null;
  try { stats = JSON.parse(safeStorageGet('civique_stats', 'null')); } catch (e) { return; }
  if (!stats?.sessions?.length) { el.innerHTML = ''; return; }
  const pct = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
  el.innerHTML = `<h3>📊 Statistiques</h3>
    <div class="stat-row"><span>Sessions</span><span>${stats.sessions.length}</span></div>
    <div class="stat-row"><span>Taux global</span><span>${pct}% (${stats.totalCorrect}/${stats.totalQuestions})</span></div>
    ${stats.examsTotal ? `<div class="stat-row"><span>Examens réussis</span><span>${stats.examsPassed}/${stats.examsTotal}</span></div>` : ''}`;
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function updateOfflineStatus() {
  const el = $('#offline-status');
  if (!el) return;
  el.textContent = allQuestions.length
    ? `✓ ${allQuestions.length} questions chargées` + (navigator.onLine ? '' : ' · hors-ligne')
    : 'Chargement…';
  el.className = 'offline-status ' + (navigator.onLine ? 'online' : 'offline');
}

window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);
boot();
