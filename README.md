# DriveNow QA Hub

The QA dashboard of [DriveNow](https://github.com/arditgashii/rentacar-platform), a rent-a-car
marketplace. One place for the three kinds of testing a QA team does:

- **Automation Tests** runs the [Python test suite](https://github.com/arditgashii/rentacar-qa-automation)
  on demand or on a schedule, one run at a time with a queue, and turns every failure into a bug
  report with the platform commits that may have caused it. Results go to Microsoft Teams.
- **Test Plans** holds the test cases (projects, suites, folders, steps, attachments), like Azure
  Test Plans. A test case shows the latest automation result for its ID.
- **Manual Regression** is the checklist for release checks, E2E passes and sprint testing, with
  results, comments, Jira links and a full history.

**Live demo:** https://drivenow-qa-hub-delta.vercel.app (sample data; log in as `admin@qahub.test` / `QaHub!2026`). The platform it tests runs at https://drivenow-68x7.onrender.com.

![Automation overview](docs/screenshots/overview.png)

## Screenshots

| | |
|---|---|
| ![Runs](docs/screenshots/runs.png) | ![Run details](docs/screenshots/run-details.png) |
| Runs grouped by day, filters in the URL | A run with Known bug failures, bug report and commits |
| ![New run](docs/screenshots/new-run.png) | ![Schedules](docs/screenshots/schedules.png) |
| New run: the summary counts the tests pytest will run | Schedules with Teams channels and last results |
| ![Suite editor](docs/screenshots/suite-editor.png) | ![Teams settings](docs/screenshots/settings.png) |
| Suite editor with smart selection | Teams channels, templates with live preview |
| ![Test Plans](docs/screenshots/test-plans.png) | ![Test case](docs/screenshots/test-case.png) |
| Test Plans: tree, list, filters | A test case with its latest automation result |
| ![Regression run](docs/screenshots/regression.png) | ![Sprint testing](docs/screenshots/sprint.png) |
| A release check in progress | Sprint items with Jira links |

On a phone (390 px) every page works without sideways scrolling:

| | | |
|---|---|---|
| ![Overview on a phone](docs/screenshots/phone-overview.png) | ![Run details on a phone](docs/screenshots/phone-run-details.png) | ![Regression on a phone](docs/screenshots/phone-regression.png) |

## Architecture

```mermaid
flowchart LR
  browser[Browser] --> web[Next.js app<br/>pages + API routes]
  web --> pg[(Postgres)]
  worker[Worker process<br/>queue, scheduler, Teams] --> pg
  worker -->|pytest| qa[rentacar-qa-automation]
  qa -->|UI and API tests| platform[DriveNow platform]
  worker -->|/health, /health/ready| platform
  worker -->|git log| platformRepo[(platform git history)]
  worker -->|Adaptive Cards| teams[Microsoft Teams<br/>or the local mock]
```

- The **web app** only reads and writes the database. Starting a run puts it in the queue.
- The **worker** (`npm run worker`) does everything slow: it starts one pytest run at a time
  (a lock file and a database row make sure of that), reads the live progress the QA suite's
  dashboard plugin writes, checks the environment before each run, retries failed tests of
  scheduled runs, finds the platform commits since a test last passed, posts to Teams, sends the
  morning summary and deletes media after 14 days.
- **Postgres** keeps the run history, schedules, suites, test plans, regression runs and members.

## Run it

You need Node 22, Docker, and the two other repos next to this one (the default paths are
`../rentacar-qa-automation` and `../rentacar-platform`), with the platform running
(`docker compose up -d --build --wait` in its folder) and the QA suite's virtual environment set up
as its README describes.

```bash
cp .env.example .env
docker compose up -d                 # Postgres on port 5433
npm install
npm run db:migrate && npm run seed   # tables, users and demo data
npm run dev:all                      # web app on http://localhost:3000 and the worker
```

`npm run teams:mock` starts a small receiver on port 3999 that stores every Teams card in
`storage/teams-mock.jsonl`; the seeded Teams channels point to it, so no Teams account is needed.
`npm run seed -- --reset` wipes everything and seeds again.

### Seeded users

All three use the password `QaHub!2026` (`SEED_PASSWORD` in `.env`).

| Email | Role | Can |
|---|---|---|
| `admin@qahub.test` | Admin | Everything, including Automation Tests, Settings and Members |
| `editor@qahub.test` | Editor | Change Test Plans and Manual Regression |
| `viewer@qahub.test` | Viewer | Read Test Plans and Manual Regression |

### Demo history

The seed builds 30 days of run history from the real test catalog and the real platform commits,
so the charts and lists are not empty on first start. These runs are marked `source = seed` in the
database. Runs you start from the dashboard are real pytest runs and are stored next to them.

### Environment variables

| Variable | Default | What it is |
|---|---|---|
| `DATABASE_URL` | `postgres://qahub:qahub-local@localhost:5433/qahub` | Postgres from `docker-compose.yml` |
| `SESSION_SECRET` | none | Encrypts the session cookie, at least 32 characters |
| `SEED_PASSWORD` | `QaHub!2026` | Password of the seeded users |
| `QA_REPO_PATH` | `../rentacar-qa-automation` | The QA suite |
| `QA_PYTHON` | the QA repo's `.venv` | Python that runs pytest |
| `PLATFORM_REPO_PATH` | `../rentacar-platform` | Git history for the "possible culprit" commits |
| `PLATFORM_URL` | `http://localhost:8000` | Where DriveNow runs |
| `PLATFORM_GITHUB_URL` | the platform repo | Commit links |
| `APP_URL` | `http://localhost:3000` | Links inside Teams messages |
| `TEAMS_ALLOW_LOCAL_WEBHOOK` | `1` in `.env.example` | Lets a channel point to the local mock |
| `JIRA_BASE_URL` | `https://jira.example.com/browse/` | Jira keys like `DN-1234` link here |
| `MEDIA_RETENTION_DAYS` | `14` | Days videos, screenshots and traces are kept |
| `SECURE_COOKIES` | off | Set to `1` behind HTTPS |

## Features

**Automation Tests** (Admin only)
- Overview: pass rate with the change against the previous period, runs, failing now, flaky; pass
  rate per day; weakest modules; tests that need attention with since when and possible culprit
  commits; next runs; module health; flaky list.
- Runs: on demand and scheduled, filters for module, feature, status, period and search, all in the
  URL; live updates; rerun, stop, watch, add to suite.
- New run: tests (module, feature, file) or a saved suite, Smoke or Full, LLM credit warning,
  headed browser, live watch; schedules with repeat rules, time and Teams options.
- Run details: the exact pytest command, stats, tests grouped by module and feature with attempts,
  history chips, single-test rerun, a bug report per failure (type, commits, steps, expected and
  actual, copy in the team's template), environment report, media, full log, suite comparison.
- Now panel: running now, queue (move to top, cancel), next run, needs attention.
- Schedules: search, sort, filters, bulk pause, resume and delete, Missed and "Tests no longer
  available" badges, automatic retry of failed tests.
- Suites: smart tree selection (module, feature, file, test), "1 test left out" with Put back,
  leave guard.
- Settings: Teams channels (links masked, never sent to the browser), two-channel mode, message
  templates with placeholders and preview, morning summary.

**Test Plans** (Admin and Editor change, Viewer reads)
- Projects, suites and folders of any depth: add, rename, move, delete to Deleted with restore.
- Test case list: sort, search by title, ID or tag (`/`), priority and state filters, bulk delete,
  CSV export, new test case with `N`.
- Test case panel: state, suite, priority, tags, description, preconditions, steps, attachments up to
  25 MB, type and automation, latest automation result linked to its run, Save with `Ctrl+S`,
  Duplicate, Delete, Maximize, Esc asks before dropping changes. IDs are never reused.
- Export and import of everything as JSON.

**Manual Regression** (Admin and Editor change, Viewer reads)
- Before release, after release, E2E and sprint runs per team and environment, kept in the URL.
- A new run copies the team's library (116 functions in 33 features). Results apply at once and
  roll back if saving fails; comments turn Jira keys and URLs into links; full history per item.
- Add modules, features and functions to the run and optionally to the library; rename; remove
  from the library.
- Complete (read only) and reopen; run history.
- Sprint runs: stories, tasks and bugs with a checked Jira link.

**Members** (Admin only): add with a temporary password, change role, set a new password, remove.

## Public demo

The web app runs on Vercel with a Postgres database on Neon, both in Frankfurt. With
`DEMO_MODE=1` it shows the sample data and switches off what needs the local setup or could be
misused by a visitor: starting runs (there is no worker or browser on Vercel), Teams, Members and
file uploads. Test Plans and Manual Regression can be tried out.

| Vercel variable | Value |
|---|---|
| `DATABASE_URL` | The pooled connection string from Neon |
| `SESSION_SECRET` | A random string of at least 32 characters |
| `SECURE_COOKIES` | `1` |
| `DEMO_MODE` | `1` |

The demo database is filled from a developer machine, because the seed reads the real test catalog
and platform history: put `DATABASE_URL=...` for Neon in `.env.neon` (never committed) and run
`npm run demo:reset`. Run it again now and then, so the sample history stays recent.

## Tests

| Command | What |
|---|---|
| `npm test` | Vitest unit tests of the pure logic (catalog, schedules, queue rules, templates, Test Plans tree, regression counts and Jira parsing) |
| `npm run e2e` | Playwright tests of the dashboard itself (33 tests: login, roles in pages and APIs, input checks, each area, every page at 390 px). Set `E2E_BASE_URL=http://localhost:3000` to run them against the dev server |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript |

GitHub Actions ([ci.yml](.github/workflows/ci.yml)) and Azure DevOps
([azure-pipelines.yml](azure-pipelines.yml)) run lint, types, unit tests, `npm audit` and a build,
then check out the QA and platform repos, seed a Postgres service and run the Playwright tests
against the production build.

## More

- [docs/DESIGN.md](docs/DESIGN.md): the design tokens and the rules behind the look.
- [docs/FEATURE-CHECKLIST.md](docs/FEATURE-CHECKLIST.md): every feature of the brief and how it was checked.
