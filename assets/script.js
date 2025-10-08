/**
 * Typing Speed Test - no-build frontend (modern neon UI + 3D)
 * - Real-time WPM, CPM, accuracy, errors
 * - Time/Word modes, custom text, language (EN/UR/ES) with RTL handling
 * - Keyboard visualization, keystroke log (optional)
 * - Leaderboard integration with optional backend at /api
 * - Local persistence for recent tests and guest averages
 * - Three.js reactive particle background
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

  // Site language switcher (header)
  const siteLang = document.getElementById('siteLangSwitch');
  if (siteLang) {
    siteLang.addEventListener('change', (e) => {
      const url = e.target.value;
      if (url) window.location.href = url;
    });
    // select current option
    const p = window.location.pathname.replace(/index\.html$/, '');
    for (const opt of siteLang.options) {
      if (p === '/' && opt.value === '/') opt.selected = true;
      else if (p !== '/' && p.startsWith(opt.value)) opt.selected = true;
    }
  }

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
    totalTimeSec: 60, // modern default longer
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
      'Long-form typing builds endurance and control. Maintain relaxed shoulders and a clear cadence as you move through each sentence with purpose and precision.',
      'Accuracy first, then speed. Breathe, keep your eyes ahead of the cursor, and let rhythm carry you through extended paragraphs that mirror real work.',
      'Neon speed is sustainable only with good form. Let your fingers travel the shortest paths and tap with confidence rather than force.'
    ],
    es: [
      'La escritura de formato largo desarrolla resistencia y control. Mantén un ritmo claro y los hombros relajados mientras avanzas con precisión.',
      'Primero la precisión, luego la velocidad. Deja que el ritmo te lleve a través de párrafos extensos que reflejan trabajo real.',
      'La velocidad sostenible nace de la buena forma. Toca con confianza, no con fuerza.'
    ],
    ur: [
      'طویل متن ٹائپ کرنا برداشت اور کنٹرول پیدا کرتا ہے۔ کندھے ڈھیلے رکھیں اور روانی کے ساتھ آگے بڑھیں۔',
      'پہلے درستگی پھر رفتار۔ حقیقی کام کی طرح مسلسل پیراگراف میں توجہ قائم رکھیں۔',
      'پائیدار رفتار اچھی عادت سے آتی ہے۔'
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
      w.split('').forEach((c) => {
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
    const sec = Math.floor((Date.now() - state.startTime) / 1000);
    const timeLabel = el.modeSelect.value === 'words' ? `${sec}s` : `${Math.max(0, state.totalTimeSec - sec)}s left`;
    el.time.textContent = timeLabel;
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
      pulse3D(true);
    } else if (key.length === 1) {
      expectedNode.classList.add('error');
      state.errors++;
      state.pos++;
      pulse3D(false);
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
      let secs = el.timeSelect.value === 'custom' ? Number(el.timeCustom.value || 60) : Number(el.timeSelect.value);
      secs = Math.max(5, Math.min(1800, secs));
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
      let text = custom || await buildLongPassage(lang);
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
    ...recents.map(r => r.wpm || 0), 1);
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

  // 3D background with Three.js
  let three = { scene: null, camera: null, renderer: null, points: null, hue: 0 };
  function init3D() {
    const canvas = document.getElementById('bg3d');
    if (!canvas || !window.THREE) return;
    const { Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, AdditiveBlending, Color, Clock } = THREE;
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 80;
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // particles
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const mat = new PointsMaterial({
      color: new Color('#7c3aed'),
      size: 1.6,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const points = new Points(geom, mat);
    scene.add(points);

    const clock = new Clock();
    function animate() {
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.05;
      points.rotation.x = Math.sin(t * 0.2) * 0.1;
      const h = (three.hue + t * 0.02) % 1;
      mat.color.setHSL(h, 0.8, 0.6);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    three = { scene, camera, renderer, points, hue: 0 };
  }
  function pulse3D(good) {
    if (!three.points) return;
    three.hue += good ? 0.05 : 0.15;
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.addEventListener('load', init3D);
  } else {
    window.addEventListener('DOMContentLoaded', init3D);
  }

  // Long passages builder
  async function buildLongPassage(lang) {
    const minWords = 250; // ensure lengthy test baseline
    const parts = [];
    let words = 0;

    // try API several times for variety
    for (let i = 0; i < 6 && words < minWords; i++) {
      try {
        const txt = await fetchPassage(lang);
        parts.push(txt);
        words += (txt.match(/\S+/g) || []).length;
      } catch (_) {
        break;
      }
    }
    // fallback local paragraphs if still short
    if (words < minWords) {
      const local = longLocalPassages[lang] || longLocalPassages.en;
      while (words < minWords) {
        const s = local[Math.floor(Math.random() * local.length)];
        parts.push(s);
        words += (s.match(/\S+/g) || []).length;
      }
    }
    return parts.join(' ');
  }

  const longLocalPassages = {
    en: [
      'Typing is not only about speed; it is about rhythm, posture, and the micro-decisions your fingers make as they travel the keyboard. This extended passage is designed to train endurance. As you progress, keep your shoulders relaxed, wrists neutral, and eyes scanning ahead of your current word. Small improvements compound over time: a fraction of a second saved on each word becomes minutes saved over the course of a day. Professional typists maintain accuracy first, then introduce bursts of speed once a stable cadence is set. Breathe, pace yourself, and avoid unnecessary corrections. When you make an error, continue forward and recover within the next words; do not dwell on a single mistake. The goal is consistency. Over a longer session your form will be tested: maintain even pressure, minimize travel, and keep an ergonomic posture. With practice, your flow improves, and the noise of hesitation fades into momentum.',
      'Long form typing mirrors real-world tasks such as drafting reports, documenting features, or writing articles. Instead of isolated sentences, these paragraphs challenge you to sustain attention. Notice how your hands adjust when punctuation appears, or when capitalization demands a shift. The objective is reliable control. If you choose a strict capitalization mode, build the habit of using the shift key precisely, without overextending your fingers. Accuracy is the cornerstone of speed. Focus on clarity, then increase pace. By the end of this session you should feel a measured fatigue: that is the signal of productive training, not strain. Stretch your fingers, roll your shoulders, and hydrate between sets.',
      'Momentum in typing is like cadence in running: a stable, repeatable beat that turns effort into effortless motion. The more you practice with extended passages, the more you internalize the rhythm of words. Avoid slamming keys; aim for confident, precise taps. Your keyboard layout hints can help you correct inefficient reaches. Watch for frequent errors and adjust your posture. Over time, your fingers will discover shorter paths and your mind will anticipate language patterns. This is the path to sustainable, high WPM with strong accuracy.'
    ],
    es: [
      'Escribir no se trata solo de velocidad; se trata de ritmo, postura y las microdecisiones que toman tus dedos mientras recorren el teclado. Este pasaje extendido entrena la resistencia. Mantén los hombros relajados y la vista por delante de la palabra actual. Los pequeños avances se acumulan. La precisión primero, la velocidad después. Respira y evita correcciones innecesarias. La meta es la consistencia. Durante una sesión larga tu forma será desafiada: conserva una postura ergonómica y presión uniforme.',
      'La mecanografía de formato largo refleja tareas reales como redactar informes o documentar funciones. En lugar de frases aisladas, estos párrafos te obligan a sostener la atención. Observa cómo ajustas la mano con la puntuación y las mayúsculas. Si eliges mayúsculas estrictas, usa la tecla shift con precisión. La precisión es la base de la velocidad. Al final deberías sentir una fatiga medida, señal de entrenamiento productivo, no de tensión.',
      'El impulso en la escritura es como la cadencia al correr: un ritmo que convierte el esfuerzo en movimiento fluido. Practicar pasajes extendidos internaliza el ritmo de las palabras. Evita golpear las teclas; apunta a toques firmes y precisos. Con el tiempo tus dedos hallarán rutas más cortas y tu mente anticipará patrones del lenguaje.'
    ],
    ur: [
      'طویل متن ٹائپ کرنا صرف رفتار نہیں بلکہ تسلسل، درستگی اور آرام دہ انداز کا نام ہے۔ یہ پیراگراف برداشت کی تربیت کے لیے ہے۔ کندھے ڈھیلے رکھیں، کلائی کو سیدھا رکھیں اور نظریں موجودہ لفظ سے آگے رکھیں۔ چھوٹی بہتریاں وقت کے ساتھ بڑی تبدیلی لاتی ہیں۔ پہلے درستگی قائم کریں پھر رفتار بڑھائیں۔ غلطی ہو تو آگے بڑھیں، ہر غلطی پر نہ رکیں۔ مقصد مستقل مزاجی ہے۔',
      'طویل سیشن حقیقی دنیا کے کاموں سے مشابہ ہیں جیسے رپورٹ لکھنا یا دستاویزی تحریر۔ رموز اوقاف اور حروفِ تہجی کے بڑے حروف پر توجہ دیں۔ اگر سخت کیپٹلائزیشن موڈ منتخب کیا ہے تو شفٹ کی کو درستگی سے دبائیں۔ آخر میں ہلکی تھکن محسوس ہو تو یہ مفید مشق کی علامت ہے۔',
      'رفتار کے ساتھ روانی بھی ضروری ہے۔ مسلسل مشق سے انگلیوں کی حرکت مختصر ہو جاتی ہے اور ذہن زبان کے پیٹرن کا اندازہ لگا لیتا ہے۔ اس طرح پائیدار رفتار اور مضبوط درستگی حاصل ہوتی ہے۔'
    ]
  };

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