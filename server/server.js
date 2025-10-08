import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

const app = express();
const PORT = process.env.PORT || 8080;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const ACCURACY_MIN = Number(process.env.ACCURACY_MIN || 80);

const DATA_DIR = process.cwd();
const DB_PATH = join(DATA_DIR, 'server', 'db.json');
const PASSAGES_PATH = join(DATA_DIR, 'server', 'passages.json');

function loadJSON(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function saveJSON(path, data) {
  try {
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed saving JSON', e);
  }
}

// Seed files if missing
if (!existsSync(PASSAGES_PATH)) {
  saveJSON(PASSAGES_PATH, {
    en: [
      'The quick brown fox jumps over the lazy dog.',
      'Typing tests help improve speed and accuracy.',
      'Practice every day to build consistent typing habits.'
    ],
    es: [
      'El zorro marrón rápido salta sobre el perro perezoso.',
      'Las pruebas de mecanografía mejoran velocidad y precisión.'
    ],
    ur: [
      'تیز بھورا لومڑی سست کتے کے اوپر سے چھلانگ لگاتی ہے۔',
      'روزانہ مشق سے مستقل عادت بنتی ہے۔'
    ]
  });
}
if (!existsSync(DB_PATH)) {
  saveJSON(DB_PATH, { tests: [] });
}

app.use(helmet());
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.use(morgan('tiny'));

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Static frontend (optional)
app.use('/', express.static(process.cwd()));

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// API
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/passages', (req, res) => {
  const all = loadJSON(PASSAGES_PATH, {});
  const lang = (req.query.lang || 'en').toString();
  const set = all[lang] || all.en || [];
  if (!set.length) return res.status(404).json({ error: 'No passages' });
  const text = pickRandom(set);
  res.json({ text, lang });
});

app.post('/api/tests', (req, res) => {
  const { userId = null, wpm, cpm = null, accuracy, duration, language = 'en', name = 'Guest', country = '' } = req.body || {};
  if (typeof wpm !== 'number' || typeof accuracy !== 'number' || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const db = loadJSON(DB_PATH, { tests: [] });
  const entry = {
    id: nanoid(),
    userId,
    name: String(name || 'Guest').slice(0, 30),
    country: String(country || '').slice(0, 10),
    wpm: Math.round(wpm),
    cpm: cpm ? Math.round(cpm) : null,
    accuracy: Math.round(accuracy),
    duration: Math.round(duration),
    language,
    createdAt: Date.now()
  };
  db.tests.push(entry);
  // Keep file small
  db.tests = db.tests.slice(-5000);
  saveJSON(DB_PATH, db);
  res.status(201).json({ ok: true, entry });
});

app.get('/api/leaderboard', (req, res) => {
  const { period = 'daily', limit = '100', country = '' } = req.query;
  const db = loadJSON(DB_PATH, { tests: [] });
  const now = Date.now();
  let since = 0;
  if (period === 'daily') since = now - 24*60*60*1000;
  else if (period === 'weekly') since = now - 7*24*60*60*1000;
  // else all-time

  const filtered = db.tests.filter(t => t.accuracy >= ACCURACY_MIN && t.wpm > 0 && t.createdAt >= since && (!country || t.country === country));
  filtered.sort((a,b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.duration - b.duration);
  const entries = filtered.slice(0, Math.max(1, Math.min(1000, Number(limit)))).map(t => ({
    id: t.id, name: t.name, country: t.country, wpm: t.wpm, accuracy: t.accuracy, duration: t.duration, language: t.language, ts: t.createdAt
  }));
  res.json({ entries });
});

// Basic admin: list and delete tests (no auth; for demo)
app.get('/api/admin/tests', (req, res) => {
  const db = loadJSON(DB_PATH, { tests: [] });
  res.json({ count: db.tests.length, tests: db.tests.slice(-200).reverse() });
});
app.delete('/api/admin/tests/:id', (req, res) => {
  const db = loadJSON(DB_PATH, { tests: [] });
  const before = db.tests.length;
  db.tests = db.tests.filter(t => t.id !== req.params.id);
  saveJSON(DB_PATH, db);
  res.json({ removed: before - db.tests.length });
});

// Security: naive anti-spoofing guard
app.use('/api/tests', (req, res, next) => {
  // placeholder for additional verification
  next();
});

// Start
app.listen(PORT, () => {
  console.log(`Typing Speed Test API on http://localhost:${PORT}`);
});