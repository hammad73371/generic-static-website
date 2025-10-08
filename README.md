# Typing Speed Test (Accessible, Mobile‑first)

A polished, responsive Typing Speed Test web app. Measure WPM, CPM, accuracy, and errors in real time. Supports multiple modes and languages (including RTL Urdu), dark/light themes, optional keyboard visualization, and a leaderboard with API.

- Frontend: No-build SPA (vanilla JS) for fast load and easy deploy
- Backend: Node.js + Express (file-based persistence) with rate limiting and simple anti-spoofing guard
- Accessibility: Keyboard navigable with clear focus outlines, ARIA live regions, WCAG AA contrast
- SEO: Meta description, fast load; can be fronted by Netlify/Vercel
- Tests: Unit tests for WPM/CPM calculations
- E2E: You can wire Playwright/Cypress; guidance below

Live site: https://typingspeedtest.co
Local demo (self-hosted): http://localhost:8080

## Features

- Time mode: 15s, 30s, 60s, 120s, and Custom
- Word-count mode: 10 / 25 / 50 words
- Languages: English (LTR), Urdu (RTL), Spanish
- Options: punctuation toggle, capitalization strictness, keyboard layout hints (QWERTY/AZERTY), optional keystroke log
- Real-time metrics: WPM, CPM, accuracy, error count
- Average WPM across last N tests (guest/local)
- Leaderboard: Daily/Weekly/All-time; 80% accuracy minimum
- Admin (demo): list and delete tests
- Dark/Light mode
- Mobile-first responsive UI

## Repository Structure

- `index.html` — SPA UI markup
- `assets/style.css` — Styles (dark-ready, responsive, accessible)
- `assets/script.js` — App logic (typing engine, metrics, leaderboard)
- `server/server.js` — Express API (passages, tests, leaderboard)
- `server/passages.json` — Curated passages per language
- `server/db.json` — File-based storage for demo
- `server/tests/wpm.test.js` + `server/utils.js` — Unit tests
- `Dockerfile`, `docker-compose.yml` — Containerization
- `api.postman_collection.json` — Postman collection for API

## Quick Start (Local)

Option A: Node + npm

1. Requirements: Node.js 18+ (uses `node:test`)
2. Install server deps:
   - `cd server`
   - `npm install`
3. Run API + static frontend:
   - From repo root: `node server/server.js`
   - Open http://localhost:8080
4. Run unit tests:
   - `cd server && npm test`

Option B: Docker

- `docker compose up --build`
- Open http://localhost:8080

Environment variables:
- `PORT` — default 8080
- `ALLOW_ORIGIN` — CORS origin, default `*` (set to your domain in production)
- `ACCURACY_MIN` — minimum accuracy for leaderboard (default 80)

## Deploy

Frontend only (static) on Netlify/Vercel:
- Deploy the root as a static site. For a full experience (leaderboard), also deploy the API (below) and set the API base via a small snippet:
  - In `index.html`, before script load, set `window.TST_API_BASE = 'https://your-api.example.com'`.

Backend on Render/Heroku/DigitalOcean:
- Render:
  - Create a new Web Service from this repo
  - Build command: `cd server && npm install`
  - Start command: `node server.js`
  - Set env: `ALLOW_ORIGIN` to your frontend origin; `ACCURACY_MIN` if desired
- Heroku:
  - Create app, set Node.js stack
  - Push and set start command accordingly
- Docker:
  - Build image and run as above

NOTE: This demo persists to `server/db.json`. For production, replace with PostgreSQL and a proper auth system. The Express handlers have a straightforward structure to swap persistence.

## API

Base: `https://your-api.example.com` (or http://localhost:8080)

- GET `/api/passages?lang=en&mode=random`
  - Returns `{ text, lang }` random passage in the requested language
- POST `/api/tests`
  - Body: `{ userId?, wpm, cpm?, accuracy, duration, language, name?, country? }`
  - Stores a test result (if `accuracy >= ACCURACY_MIN`) and returns `{ ok, entry }`
- GET `/api/leaderboard?period=daily|weekly|all&limit=100&country=US`
  - Returns `{ entries: [{ name, country, wpm, accuracy, duration, language, ts }] }`
- Admin (demo):
  - GET `/api/admin/tests` — recent tests
  - DELETE `/api/admin/tests/:id` — remove test by id

Import `api.postman_collection.json` into Postman to try endpoints.

## Accessibility

- Keyboard navigable: skip link, clear focus outlines, logical tab order
- ARIA live region announces current character
- High contrast colors (WCAG AA)
- RTL support for Urdu via `dir="rtl"` on passage container
- Caret and current character highlighting; errors underline red wavy

Run Lighthouse or axe:
- Lighthouse: 90+ Accessibility expected
- Use the keyboard only to complete a test

## Security and Rate Limits

- `express-rate-limit` set to 60 requests per minute (tune per deployment)
- Basic anti-spoofing placeholder; for production, add:
  - Server-side recalculation/verification
  - Bot detection and IP/device fingerprint checks
  - Authenticated submissions and reCAPTCHA for guests

## Testing

- Unit tests: `cd server && npm test`
  - Tests `wpmFromCounts` and `cpmFromCounts`
- E2E (suggested):
  - Add Playwright:
    ```
    npm init -y
    npm i -D @playwright/test
    npx playwright codegen http://localhost:8080
    ```
  - Record a typing session, assert real-time WPM updates and final stats render

## Admin and Moderation

- Passages:
  - Edit `server/passages.json` to add/remove content per language
  - Add Spanish/Urdu passages to broaden content
- Leaderboard moderation:
  - Use `GET /api/admin/tests` to review recent tests
  - Remove an entry with `DELETE /api/admin/tests/:id`

## Adding Languages

1. Add passages for the new language in `server/passages.json`
2. Add option in the Language select in `index.html`
3. If RTL, set `dir="rtl"` dynamically (already handled for Urdu in the code)

## Notes on Optional Features

- Authentication: You can integrate Firebase Auth or Google OAuth and pass `userId/name/country` in `POST /api/tests`
- Analytics: Add GA4 or Plausible script tags in `index.html`
- SEO: If SSR is desired, migrate the frontend into Next.js; the backend endpoints stay compatible

## License

MIT. Generated by Genie.
