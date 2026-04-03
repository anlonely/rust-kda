# Rust KDA / Rust Player Profile Query Site

[中文](./README.md) | [English](./README.en.md)

Rust KDA is a small web project for querying public Rust player data, combining:

- `Steam Web API` for player profile, Rust playtime, and official stats
- `SCMM` for Rust skin pricing and inventory valuation
- `Steam inventory pages` for extra public item names
- `BattleMetrics` for server playtime candidates and session records

## 1. Scope

### Included

- Player profile lookup
- Rust KDA and profile stats
- Public inventory aggregation and valuation
- Official item store cross-match
- BattleMetrics candidate selection before loading server playtime
- Entry password and session authentication
- Basic rate limiting

### Limitations

- `BattleMetrics` availability depends on third-party anti-bot behavior
- Server playtime is not guaranteed to work from every server IP
- Pack / building skin ownership cannot always be inferred with 100% accuracy from public inventory alone
- Some fields depend on Steam privacy settings

## 2. Tech Stack

### Backend

- `Flask`
- `Flask-CORS`
- `Gunicorn`

Main file:

- `rust_query_server_v2.py`

### Frontend

- `React 18`
- `Vite`

Main files:

- `rust_query_app_v2.jsx`
- `src/App.jsx`
- `src/main.jsx`

### Tests

- `pytest`

## 3. Project Structure

```text
rust-kda/
├── rust_query_server_v2.py
├── rust_query_app_v2.jsx
├── src/
│   ├── App.jsx
│   └── main.jsx
├── tests/
│   └── test_server.py
├── index.html
├── vite.config.js
├── package.json
├── requirements.txt
├── pytest.ini
└── .env.example
```

## 4. Quick Start

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Configure environment variables

```bash
cp .env.example .env
```

Then fill in your own values:

```bash
STEAM_API_KEY="your-steam-key"
BATTLEMETRICS_TOKEN="your-battlemetrics-token"
APP_ACCESS_PASSWORD="change-me-access-password"
APP_SESSION_SECRET="change-me-to-a-long-random-secret"
ALLOWED_ORIGINS="https://your-domain.example"
```

### Start backend

```bash
.venv/bin/python rust_query_server_v2.py
```

Default:

- `http://127.0.0.1:5050`

### Start frontend

```bash
npm run dev
```

Default:

- `http://127.0.0.1:5173`

## 5. Production Notes

Recommended deployment shape:

- `Nginx` serves the frontend
- `Gunicorn` runs the Flask app
- reverse proxy only for `/api/*`
- enable HTTPS

Recommended production settings:

- `SESSION_COOKIE_SECURE=true`
- `FLASK_DEBUG=false`
- `ALLOWED_ORIGINS` should only include your real domain
- never use public example passwords in production
- keep Steam and BattleMetrics tokens only in server-side `.env`

## 6. Validation

Frontend build:

```bash
npm run build
```

Backend tests:

```bash
.venv/bin/pytest -q
```

## 7. Security

Do not commit:

- `.env`
- Steam API keys
- BattleMetrics tokens
- entry password
- session secret
- deployment logs
- scraping/debug output

Ignored by default:

- `.env`
- `output/`
- `.playwright-cli/`
- `.venv/`
- `node_modules/`

## 8. Known Issues

- BattleMetrics may return a Cloudflare challenge for some server IPs
- when that happens, server playtime will be unavailable
- this is a third-party access restriction, not a frontend rendering bug

## 9. License

This project is released under the [MIT License](./LICENSE).
