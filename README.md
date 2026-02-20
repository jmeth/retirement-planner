# Retirement Planner

A web-based retirement planning tool built with Flask. Model multiple retirement scenarios across different account types, investment strategies, and life events to project your financial future.

## Features

- **Multiple account types** — 401k, Traditional IRA, Roth IRA, Taxable Brokerage, Savings, Real Estate
- **Scenario analysis** — best / expected / worst case projections for each retirement age
- **Glide-path returns** — configure how investment returns shift as you approach retirement
- **Life events** — model one-time inflows and outflows (bonuses, tuition, inheritance, etc.)
- **Social Security** — inflation-adjusted SS income modeled from your chosen start age
- **Age-based withdrawal strategy** — avoids early-withdrawal penalties before 59.5
- **Optional authentication** — protect the app with a username/password when hosting publicly

## Running Locally

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5005` in your browser.

## Running with Docker

```bash
docker build -t retirement-planner .
docker run -p 5005:5005 retirement-planner
```

With authentication enabled:

```bash
docker run -p 5005:5005 \
  -e SECRET_KEY=your-secret-key \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=yourpassword \
  retirement-planner
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | random | Flask session secret — set a fixed value in production |
| `ADMIN_USER` | _(unset)_ | Username for login. Auth is disabled when unset. |
| `ADMIN_PASS` | _(unset)_ | Password for login. Auth is disabled when unset. |
| `FLASK_DEBUG` | `false` | Set to `true` to enable the Werkzeug debugger. Never enable in production. |
| `FLASK_HOST` | `127.0.0.1` | Interface to bind to. Set to `0.0.0.0` inside Docker/containers. |

## CI/CD

The GitHub Actions pipeline at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs automatically on every pull request and push.

| Event | Jobs |
|-------|------|
| Pull request | lint, scan, build, test |
| Push to `main` | lint, scan, build, test → build & push container image tagged `latest` |
| Push a git tag | lint, scan, build, test → build & push container image tagged with the tag name |

Container images are published to `ghcr.io/<org>/<repo>`.

## File Structure

```
.
├── app.py                  # Flask app and retirement calculator
├── requirements.txt        # Python dependencies
├── Dockerfile
├── templates/
│   ├── index.html          # Configuration page
│   ├── results.html        # Results page
│   └── login.html          # Login page (shown when auth is enabled)
└── static/
    ├── css/style.css
    └── js/
        ├── config.js
        └── results.js
```

## How It Works

### Configuration

The app walks you through four sections:

1. **Personal info** — current age, life expectancy, Social Security details, target retirement ages
2. **Accounts** — balances, annual contributions, employer match, contribution limits
3. **Investment strategy** — milestone-based return rates that shift as you near retirement
4. **Life events** — one-time credits or debits applied to a specific account in a specific year

### Calculations

- Contributions grow with inflation each year during the accumulation phase
- Returns compound annually; contributions earn a half-year return in their first year
- At retirement the calculator sets an initial withdrawal target (configurable, or 4% of investable assets)
- Withdrawals increase with inflation each year; Social Security offsets portfolio withdrawals once started
- Accounts accessible for withdrawal are gated by age (pre-59.5, pre-SS, post-SS)

### Data Storage

Configuration lives in the Flask session (server-side). Results are computed on demand — no database required.
