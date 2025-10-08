/**
 * Typing Speed Test - no-build frontend
 * - Real-time WPM, CPM, accuracy, errors
 * - Time/Word modes, custom text, language (EN/UR/ES) with RTL handling
 * - Keyboard visualization, keystroke log (optional)
 * - Leaderboard integration with optional backend at /api
 * - Local persistence for recent tests and guest averages
 * Accessibility: keyboard navigable, ARIA updates, WCAG AA contrast via theme
 */

(function () {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  const el = {
    startBtn: qs('#startBtn'),
    resetBtn: qs('#resetBtn'),
    modeSelect: qs('#modeSelect'),
    timeSelect: qs('#timeSelect'),
    timeCustom: qs('#timeCustom'),
    timeControl: qs('#timeControl'),
    wordsControl: qs('#wordsControl'),
    wordsSelect: qs('#wordsSelect'),
    langSelect: qs('#langSelect'),
    layoutSelect: qs('#layoutSelect'),
    showPunct: qs('#showPunct'),
    strictCaps: qs('#strictCaps'),
    showKeyboard: qs('#showKeyboard'),
    keystrokeLog: qs('#keystrokeLog'),
    customText: qs('#customText'),
    passage: qs('#passage'),
    hiddenInput: qs('#hiddenInput'),
    keyboard: qs('#keyboard'),
    wpm: qs('#wpm'),
    cpm: qs('#cpm'),
    accuracy: qs('#accuracy'),
    errors: qs('#errors'),
    time: qs('#time'),
    avgWpm: qs('#avgWpm'),
    periodSelect: qs('#periodSelect'),
    countrySelect: qs('#countrySelect'),
    leaderboardList: qs('#leaderboardList'),
    themeToggle: qs('#themeToggle'),
    sparkline: qs('#sparkline'),
    srCurrent: qs('#sr-current'),
  };

  // Config
  const CONFIG = {
    apiBase: '', // empty uses same origin; override via window.TST_API_BASE if set
    leaderboardMinAccuracy: 80,
    recentsCount: 10,
  };
  if (window.TST_API_BASE) CONFIG.apiBase = window.TST_API_BASE;

  // State
  let state = {
    started: false,
    timer: null,
    startTime: 0,
    elapsed: 0,
    totalTimeSec: 30, // default
    wordsTarget: null,
    passage: [],
    pos: 0, // char index
    errors: 0,
    correct: 0,
    inputBuffer: '',
    keylog: [],
    dir: 'ltr',
    lang: 'en',
  };

  const passages = {
    en: [
      'The quick brown fox jumps over the lazy dog.',
      'Typing tests help improve speed and accuracy.',
      'Practice every day to build consistent typing habits.',
      'A clean keyboard leads to a focused mind.',
      'Measure words per minute and track your progress.',
    ],
    es: [
      'El zorro marrón rápido salta sobre el perro perezoso.',
      'Las pruebas de mecanografía mejoran velocidad y precisión.',
      'Practica cada día para formar hábitos consistentes.',
      'Una mente clara nace de una práctica constante.',
    ],
    ur: [
      'تیز بھورا لومڑی سست کتے کے اوپر سے چھلانگ لگاتی ہے۔',
      'ٹائپنگ ٹیسٹ رفتار اور درستگی میں بہتری لاتے ہیں۔',
      'روزانہ مشق سے مستقل عادت بنتی ہے۔',
    ],
  };

  // Accessibility: focus management
  function focusInput() {
    el.hiddenInput.focus();
  }

  // Theme toggle
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let dark = prefersDark;
  function applyTheme() {
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    el.themeToggle.textContent = dark ? 'Light' : 'Dark';
    el.themeToggle.setAttribute('aria-pressed', String(dark));
  }
  el.themeToggle.addEventListener('click', () => {
    dark = !dark;
    applyTheme();
  });
  applyTheme();

  // Mode toggles
  function updateModeUI() {
    const mode = el.modeSelect.value;
    if (mode === 'time') {
      el.timeControl.classList.remove('hidden');
      el.wordsControl.classList.add('hidden');
    } else {
      el.timeControl.classList.add('hidden');
      el.wordsControl.classList.remove('hidden');
    }
  }
  el.modeSelect.addEventListener('change', updateModeUI);
  updateModeUI();

  el.timeSelect.addEventListener('change', () => {
    const v = el.timeSelect.value;
    if (v === 'custom') {
      el.timeCustom.classList.remove('hidden');
      el.timeCustom.focus();
    } else {
      el.timeCustom.classList.add('hidden');
    }
  });

  el.langSelect.addEventListener('change', () => {
    const lang = el.langSelect.value;
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    state.lang = lang;
    state.dir = dir;
    el.passage.setAttribute('dir', dir);
    el.passage.setAttribute('lang', lang);
  });

  // Keyboard layout hints
  function buildKeyboard(layout) {
    const rows = layout === 'azerty'
      ? ['1234567890', 'azertyuiop', 'qsdfghjklm', 'wxcvbn']
      : ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    el.keyboard.innerHTML = '';
    rows.forEach((r) => {
      const spacer = document.createElement('div');
      spacer.style.gridColumn = 'span 3';
      r.split('').forEach((ch) => {
        const k = document.createElement('div');
        k.className = 'k';
        k.dataset.key = ch;
        k.textContent = ch.toUpperCase();
        k.style.gridColumn = 'span 3';
        el.keyboard.appendChild(k);
      });
      el.keyboard.appendChild(spacer);
    });
  }
  buildKeyboard(el.layoutSelect.value);
  el.layoutSelect.addEventListener('change', (e) => {
    buildKeyboard(e.target.value);
  });

  el.showKeyboard.addEventListener('change', () => {
    const show = el.showKeyboard.checked;
    el.keyboard.classList.toggle('hidden', !show);
    el.keyboard.setAttribute('aria-hidden', String(!show));
  });

  // Passage management
  async function fetchPassage(lang) {
    // Try API; fallback to local
    try {
      const res = await fetch(`${CONFIG.apiBase || ''}/api/passages?lang=${encodeURIComponent(lang)}&mode=random`, { credentials: 'omit' });
      if (res.ok) {
        const data = await res.json();
        return data.text;
      }
    } catch (_) { /* ignore */ }
    // Fallback local
    const set = passages[lang] || passages.en;
    return set[Math.floor(Math.random() * set.length)];
  }

  function normalizeText(text) {
    // Strip punctuation/case if toggled
    let t = text;
    if (!el.showPunct.checked) {
      t = t.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»،۔؟¡!¿]/g, '');
    }
    if (!el.strictCaps.checked) {
      t = t.toLowerCase();
    }
    // Collapse whitespace
    return t.replace(/\s+/g, ' ').trim();
  }

  function renderPassage(text) {
    el.passage.innerHTML = '';
    const words = text.split(' ');
    const frag = document.createDocumentFragment();
    words.forEach((w, wi) => {
      const spanWord = document.createElement('span');
      spanWord.className = 'word';
      w.split('').forEach((c, ci) => {
        const spanChar = document.createElement('span');
        spanChar.className = 'char';
        spanChar.textContent = c;
        spanChar.dataset.index = String(state.pos++);
        spanWord.appendChild(spanChar);
      });
      if (wi < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'char';
        space.textContent = ' ';
        space.dataset.index = String(state.pos++);
        spanWord.appendChild(space);
      }
      frag.appendChild(spanWord);
      if (wi < words.length - 1) frag.appendChild(document.createTextNode(''));
    });
    el.passage.appendChild(frag);
    // reset pos to 0 for typing traversal
    state.pos = 0;
    highlightCurrent();
  }

  function highlightCurrent() {
    qsa('.char.current').forEach((n) => n.classList.remove('current', 'caret'));
    const span = qs(`.char[data-index="${state.pos}"]`);
    if (span) {
      span.classList.add('current', 'caret');
      el.srCurrent.textContent = `Current character: ${span.textContent === ' ' ? 'space' : span.textContent}`;
      span.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function wpmFromCounts(charsCorrect, elapsedMs) {
    const minutes = elapsedMs / 60000;
    const words = charsCorrect / 5;
    return Math.round(words / Math.max(minutes, 1/60000));
  }
  function cpmFromCounts(charsCorrect, elapsedMs) {
    const minutes = elapsedMs / 60000;
    return Math.round(charsCorrect / Math.max(minutes, 1/60000));
  }

  function updateMetrics() {
    const elapsed = Date.now() - state.startTime;
    const wpm = wpmFromCounts(state.correct, elapsed);
    const cpm = cpmFromCounts(state.correct, elapsed);
    const typed = state.correct + state.errors;
    const accuracy = typed === 0 ? 100 : Math.max(0, Math.round((state.correct / typed) * 100));
    el.wpm.textContent = String(wpm);
    el.cpm.textContent = String(cpm);
    el.accuracy.textContent = `${accuracy}%`;
    el.errors.textContent = String(state.errors);
    const secLeft = state.wordsTarget ? Math.floor(elapsed / 1000) : Math.max(0, state.totalTimeSec - Math.floor(elapsed / 1000));
    el.time.textContent = state.wordsTarget ? `${secLeft}s` : `${secLeft}s left`;
    drawSparkline();
  }

  function endTest() {
    if (!state.started) return;
    state.started = false;
    clearInterval(state.timer);
    el.resetBtn.disabled = false;
    el.startBtn.disabled = false;

    // Final metrics
    const elapsed = Math.max(1, Date.now() - state.startTime);
    const wpm = wpmFromCounts(state.correct, elapsed);
    const cpm = cpmFromCounts(state.correct, elapsed);
    const typed = state.correct + state.errors;
    const accuracy = typed === 0 ? 100 : Math.max(0, Math.round((state.correct / typed) * 100));
    persistResult({ wpm, cpm, accuracy, duration: Math.round(elapsed/1000), language: state.lang, timestamp: Date.now() });
    submitLeaderboard({ wpm, accuracy }).catch(() => {});
    updateAvgWpm();
    refreshLeaderboard();
  }

  function tick() {
    updateMetrics();
    if (el.modeSelect.value === 'time') {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      const total = state.totalTimeSec;
      if (elapsed >= total) {
        endTest();
      }
    } else if (el.modeSelect.value === 'words') {
      if (state.pos >= state.passage.length) {
        endTest();
      }
    }
  }

  function onKeyDown(e) {
    if (!state.started) return;
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {
      e.preventDefault();
    }
    if (el.keystrokeLog.checked) {
      state.keylog.push({ k: e.key, t: Date.now() });
    }
    // keyboard viz
    const sel = `.k[data-key="${String(e.key).toLowerCase()}"]`;
    const keyEl = el.keyboard.querySelector(sel);
    if (keyEl) keyEl.classList.add('active');
    setTimeout(() => keyEl && keyEl.classList.remove('active'), 120);

    if (e.key === 'Backspace') {
      if (state.pos > 0) {
        const prev = qs(`.char[data-index="${state.pos-1}"]`);
        if (prev) {
          prev.classList.remove('correct', 'error');
        }
        state.pos--;
        highlightCurrent();
      }
      return;
    }

    // Determine expected char
    const expectedNode = qs(`.char[data-index="${state.pos}"]`);
    if (!expectedNode) return;
    const expectedRaw = expectedNode.textContent;

    let key = e.key;
    if (!el.strictCaps.checked) key = key.toLowerCase();

    // normalize punctuation off
    if (!el.showPunct.checked) {
      if (/^[\p{P}\p{S}]$/u.test(key)) {
        // ignore punctuation keystrokes
        return;
      }
    }

    // Space and Enter both count as space if in passage there is space
    if (key === 'Enter' || key === 'Tab') key = ' ';
    if (key === ' ') key = ' ';

    // Compare
    const expected = !el.strictCaps.checked ? expectedRaw.toLowerCase() : expectedRaw;
    if (key.length === 1 && key === expected) {
      expectedNode.classList.add('correct');
      state.correct++;
      state.pos++;
    } else if (key.length === 1) {
      expectedNode.classList.add('error');
      state.errors++;
      state.pos++;
    }

    highlightCurrent();

    // words mode end condition
    if (el.modeSelect.value === 'words' && state.pos >= state.passage.length) {
      endTest();
    }
  }

  function onStart() {
    // prepare state
    state = {
      ...state,
      started: true,
      startTime: Date.now(),
      correct: 0,
      errors: 0,
      pos: 0,
      keylog: [],
    };
    el.startBtn.disabled = true;
    el.resetBtn.disabled = false;
    el.hiddenInput.value = '';
    focusInput();

    // Determine target/time
    if (el.modeSelect.value === 'time') {
      let secs = el.timeSelect.value === 'custom' ? Number(el.timeCustom.value || 30) : Number(el.timeSelect.value);
      secs = Math.max(5, Math.min(600, secs));
      state.totalTimeSec = secs;
      el.time.textContent = `${secs}s left`;
    } else {
      state.wordsTarget = Number(el.wordsSelect.value);
    }

    // Passage text
    const custom = el.customText.value.trim();
    const lang = el.langSelect.value;
    state.lang = lang;
    state.dir = lang === 'ur' ? 'rtl' : 'ltr';
    el.passage.setAttribute('dir', state.dir);
    el.passage.setAttribute('lang', state.lang);

    const chooseText = async () => {
      let text = custom || await fetchPassage(lang);
      text = normalizeText(text);
      if (el.modeSelect.value === 'words' && state.wordsTarget) {
        const words = text.split(' ');
        text = words.slice(0, state.wordsTarget).join(' ');
      }
      state.passage = text;
      renderPassage(text);
    };
    chooseText().then(() => {
      clearInterval(state.timer);
      state.timer = setInterval(tick, 200);
      tick();
    });
  }

  function onReset() {
    clearInterval(state.timer);
    state.started = false;
    state.pos = 0;
    el.startBtn.disabled = false;
    el.resetBtn.disabled = true;
    el.passage.innerHTML = '';
    state.correct = 0;
    state.errors = 0;
    el.wpm.textContent = '0';
    el.cpm.textContent = '0';
    el.accuracy.textContent = '100%';
    el.errors.textContent = '0';
    el.time.textContent = '0s';
    focusInput();
  }

  // Recent results in localStorage
  function persistResult(result) {
    const key = 'tst_recent_results';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(result);
    const pruned = existing.slice(0, CONFIG.recentsCount);
    localStorage.setItem(key, JSON.stringify(pruned));
  }
  function getRecentResults() {
    const key = 'tst_recent_results';
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  function updateAvgWpm() {
    const recents = getRecentResults();
    const n = recents.length || 1;
    const avg = Math.round(recents.reduce((a, r) => a + (r.wpm || 0), 0) / n);
    el.avgWpm.textContent = String(avg);
  }
  function drawSparkline() {
    const recents = getRecentResults().slice(0, 20).reverse();
    const c = el.sparkline;
    const w = c.width = c.clientWidth || 600;
    const h = c.height = c.height; // keep height set
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,w,h);
    if (recents.length < 2) return;
    const max = Math.max(...recents.map(r => r.wpm || 0), 1);
    const step = w / (recents.length - 1);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    recents.forEach((r, i) => {
      const x = i * step;
      const y = h - (r.wpm / max) * (h - 2) - 1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Leaderboard
  async function refreshLeaderboard() {
    const period = el.periodSelect.value;
    const country = el.countrySelect.value;
    const list = el.leaderboardList;
    list.innerHTML = '';
    // Try API
    try {
      const url = new URL(`${CONFIG.apiBase || ''}/api/leaderboard`, window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '100');
      if (country) url.searchParams.set('country', country);
      const res = await fetch(url.toString(), { credentials: 'omit' });
      if (res.ok) {
        const data = await res.json();
        renderLeaderboard(data.entries || []);
        return;
      }
    } catch (_) { /* ignore */ }
    // fallback to recent local results as a pseudo leaderboard
    const recents = getRecentResults().map((r, i) => ({
      name: 'Guest',
      wpm: r.wpm,
      accuracy: r.accuracy,
      country: '',
      ts: r.timestamp || (Date.now() - i*1000),
    })).filter(e => e.accuracy >= CONFIG.leaderboardMinAccuracy)
      .sort((a,b) => b.wpm - a.wpm)
      .slice(0, 10);
    renderLeaderboard(recents);
  }

  function renderLeaderboard(entries) {
    el.leaderboardList.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = 'No entries yet.';
      el.leaderboardList.appendChild(li);
      return;
    }
    entries.forEach((e) => {
      const li = document.createElement('li');
      li.className = 'lb-item';
      li.innerHTML = `<span class="lb-name">${escapeHtml(e.name || 'Guest')}</span>
      <span class="lb-score">${e.wpm} WPM • ${e.accuracy}%</span>${e.country ? ` <span aria-hidden="true">• ${e.country}</span>` : ''}`;
      el.leaderboardList.appendChild(li);
    });
  }

  async function submitLeaderboard({ wpm, accuracy }) {
    if (accuracy < CONFIG.leaderboardMinAccuracy) return;
    try {
      await fetch(`${CONFIG.apiBase || ''}/api/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpm, accuracy, duration: state.totalTimeSec, language: state.lang,
          name: 'Guest', country: el.countrySelect.value || ''
        })
      });
    } catch (_) { /* ignore */ }
  }

  // Utils
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
  }

  // Bindings
  el.startBtn.addEventListener('click', onStart);
  el.resetBtn.addEventListener('click', onReset);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onStart();
    }
  });
  el.hiddenInput.addEventListener('keydown', onKeyDown);
  el.periodSelect.addEventListener('change', refreshLeaderboard);
  el.countrySelect.addEventListener('change', refreshLeaderboard);
  el.passage.addEventListener('click', focusInput);
  // initial
  updateAvgWpm();
  refreshLeaderboard();
  drawSparkline();

  // Expose WPM calc for tests
  window.__tst = { wpmFromCounts, cpmFromCounts };
})();