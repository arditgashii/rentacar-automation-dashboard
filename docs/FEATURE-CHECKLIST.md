# Feature checklist

Every bullet of the brief, its status and how it was checked. "e2e" means a test in `e2e/` that runs
in CI; "clicked" means it was clicked through once in a real browser with a throwaway Playwright
script against the running app (with the real worker, QA suite and platform); "unit" means a Vitest
test in `src/`.

## Roles and access

| Feature | Status | Checked |
|---|---|---|
| Automation Tests and Settings are Admin only; others are redirected to `/test-plans`, APIs answer 403 | done | e2e `access.spec.ts` |
| No session: pages go to the login with `?next=`, APIs answer 401 | done | e2e `auth.spec.ts` |
| Test Plans and Regression: Admin and Editor change, Viewer reads (no change buttons, API 403) | done | e2e `access.spec.ts` |
| Members is Admin only | done | e2e `access.spec.ts` |
| A user without a role sees No access | done | clicked |
| Seed users `admin@`, `editor@`, `viewer@qahub.test` with `QaHub!2026` | done | e2e `auth.setup.ts` |
| Odd ids and extra JSON fields are refused | done | e2e `access.spec.ts` |
| No password and no Teams link in any API response | done | e2e `access.spec.ts` |

## Layout

| Feature | Status | Checked |
|---|---|---|
| Sidebar: Automation Tests (Overview, Runs, Schedules, Suites), Test Plans, Manual Regression, Settings, Members, user, Log out | done | clicked |
| Sidebar is a drawer on phones | done | e2e `phone.spec.ts` |
| Breadcrumbs on every page | done | clicked |

## Automation Tests: entry and navigation

| Feature | Status | Checked |
|---|---|---|
| Four pill tabs with their own URLs, Back and Forward work | done | clicked |
| Gear icon opens Settings; breadcrumbs | done | clicked |
| New run button in the header | done | e2e `automation.spec.ts` |
| `?view=scheduled` redirects to Schedules | done | clicked |
| A run or suite that does not exist shows a not found message | done | clicked |
| The Now panel on every Automation page | done | clicked |

## Overview

| Feature | Status | Checked |
|---|---|---|
| Stat cards with info icons: pass rate with change, runs, failing now, flaky | done | clicked |
| 7 / 30 days switch, also with the arrow keys | done | clicked |
| Pass rate per day chart with gaps and hover | done | clicked |
| Per module chart: 5 weakest by default, add and remove, "Choose at least one module." | done | clicked |
| Needs attention with since when, failure type and culprit commits, links to the run | done | clicked |
| Running now / Queue, Next runs (paused hidden), Module health, Flaky list ("2 of 10 runs not clean") | done | clicked |
| Loading, error with Retry, empty with New run | done | clicked |

## Runs

| Feature | Status | Checked |
|---|---|---|
| Tabs All / On demand / Scheduled in the URL | done | clicked |
| Filters module, feature, status, period (Custom: From not after To, at most 31 days), search, Clear all, all in the URL | done | clicked, unit (period) |
| Grouped by day with pagination | done | clicked |
| Run card: counts, Rerun, View more, Watch, Add to suite, Stop | done | clicked |
| A run started elsewhere appears without a refresh | done | clicked (a scheduled run appeared while the page was open) |

## New run dialog

| Feature | Status | Checked |
|---|---|---|
| Run now and Schedule modes; Tests or Suite | done | e2e `automation.spec.ts`, clicked |
| Environment Local only (Docker and CI disabled with a tooltip), then Modules, Features, Test files | done | clicked |
| Smoke or Full (defaults Full / Smoke), note when there are no smoke tests | done | clicked |
| Live summary with the real count ("5 tests in Fleet (All) on Local") | done | e2e, unit |
| LLM credits box only for costly tests, warning when ticked | done | clicked |
| Show the browser window, Watch live | done | clicked |
| Add to queue while running, disabled with 0 tests | done | e2e, clicked |
| Schedule: name, repeat rules, time, Teams options, validation messages | done | clicked, unit (schedule) |
| Edit schedule opens the same dialog | done | clicked |
| Escape closes an open menu first, then the dialog | done | e2e `automation.spec.ts` |

## Run details

| Feature | Status | Checked |
|---|---|---|
| Header, status, meta line | done | clicked |
| Rerun; menu with Add to suite, Watch recording, API changes, Copy run ID | done | clicked |
| Command box with the exact pytest command | done | clicked |
| Stat cards that filter, Known bug card when there are any | done | clicked |
| Tests grouped by module and feature, setup group, attempts, Flaky / Failing since chips, single-test rerun (costly asks) | done | clicked |
| Bug report per failure: type, commits linked to GitHub, steps, expected and actual, Copy bug report in the team template | done | clicked, unit (bug report) |
| Environment report with seed age and the warning after 7 days | done | clicked (the platform now reports `seededAt`) |
| Media: video, screenshots, trace command; note when deleted | done | clicked |
| Terminal output | done | clicked |
| Suite comparison | done | clicked |
| Live progress, refresh when it ends | done | clicked (full run from the UI) |

## Now panel

| Feature | Status | Checked |
|---|---|---|
| Running now with progress and Stop; "Nothing is running." | done | clicked |
| Queue with Move to top, Cancel, Cancel all | done | clicked |
| Next run, Needs attention (max 5) | done | clicked |
| A section below the content on phones | done | e2e `phone.spec.ts` |

## Schedules

| Feature | Status | Checked |
|---|---|---|
| Table with search, sort and filters | done | clicked |
| Run now, Edit, Pause / Resume (badge and "-"), Delete | done | e2e `automation.spec.ts`, clicked |
| Bulk bar: "2 selected" with Pause, Resume, Delete, Clear | done | clicked |
| Missed and "Tests no longer available" badges (Run now disabled) | done | clicked |
| Last result link, Teams column (name, Off, Channel deleted) | done | clicked |
| Scheduled runs retry failed tests twice; Run now never retries | done | clicked (TC-005 ran 3 times in a scheduled run) |

## Suites

| Feature | Status | Checked |
|---|---|---|
| Table with menu, search and sort | done | clicked |
| Editor: name and description, empty and duplicate names refused | done | clicked |
| Test tree with search and counts, tests loaded when a file opens, "Could not read ..." with Try again | done | clicked |
| Smart selection: removing a feature keeps the others; all files collapse into the feature | done | clicked, unit |
| "1 test left out" with Put back | done | clicked, unit |
| In this suite: totals, remove, LLM warning | done | clicked |
| Save and Cancel; Run and Schedule hidden while dirty; leaving asks first | done | clicked |
| Runs of the suite; Delete suite | done | clicked |

## Settings: Microsoft Teams

| Feature | Status | Checked |
|---|---|---|
| Add channel with a masked link, only Teams / Power Automate links (localhost with the flag) | done | clicked |
| Two channels mode | done | clicked |
| Link shown only as its last 6 characters, never in the browser | done | clicked, e2e `access.spec.ts` |
| Edit keeps the old link; duplicate names refused; Send test; Delete refused when used | done | clicked |
| Setup help in 4 steps | done | clicked |
| Templates: placeholder chips at the cursor, live preview, unknown placeholder or empty first line blocks Save, Reset, unsaved warning | done | clicked, e2e `automation.spec.ts`, unit |
| Morning summary on / off with channel; failures only while on | done | clicked |
| Teams mock receiver (`npm run teams:mock`) | done | clicked (test message and a scheduled run card arrived) |

## Behind the pages

| Feature | Status | Checked |
|---|---|---|
| One run at a time, queue max 10, no duplicates, stale items dropped, starts by itself | done | clicked (second run queued and started by itself; duplicate refused), unit |
| Lock file plus database row, stale lock released | done | clicked |
| Environment check before every run | done | clicked |
| Failure insight with type, history and commits | done | clicked, unit |
| Media retention after 14 days | done | unit |

## Quality

| Feature | Status | Checked |
|---|---|---|
| Every page at 390 px without sideways scroll, dialogs fit | done | e2e `phone.spec.ts`, screenshots |
| Long names cut with the full text on hover | done | clicked |
| Tab reaches everything with a focus ring; Escape order in dialogs | done | e2e `automation.spec.ts` |

## Test Plans

| Feature | Status | Checked |
|---|---|---|
| New project, rename, delete (to Deleted with its suites and test cases) | done | clicked |
| Suites and folders of any depth, rename, move up / down, delete with the numbers in the message | done | clicked, e2e `test-plans.spec.ts` |
| Row buttons on hover or focus, count otherwise | done | clicked |
| Open folders remembered after a refresh | done | clicked |
| "Projects" button on phones | done | clicked |
| Deleted with Restore; "Restore its folder first" | done | clicked, e2e |
| Export JSON, Import JSON with confirmation and a report | done | clicked |
| List: breadcrumbs, sortable columns, search by title / ID / tag, `/` focuses search | done | clicked, e2e |
| Priority and state filters, select all, bulk delete, CSV export | done | clicked |
| New test case with `N`; messages when there is no project or suite | done | clicked, e2e |
| Empty states | done | clicked |
| Panel: header, title, latest result linked to the run, grey band, description, preconditions | done | clicked |
| Steps: add, move, delete | done | clicked, e2e |
| Attachments: several files up to 25 MB, image preview, remove with confirmation, only after saving | done | clicked |
| More details: type, automation, automated test, created and updated | done | clicked |
| Save with Ctrl+S, Duplicate (asks when dirty), Delete, Maximize, Esc asks "Discard changes?" | done | clicked, e2e |
| IDs per project, never reused, past TC-1000 | done | clicked, unit |
| Typing during a save is never lost | done | clicked |
| `?case=<id>` opens the test case | done | clicked |
| Seed: DriveNow project, TC-001 to TC-012 from the QA docs, 15 manual test cases | done | clicked |

## Manual Regression

| Feature | Status | Checked |
|---|---|---|
| Four kinds, each with its own page and tabs | done | clicked |
| Team, environment and release in the URL | done | clicked, e2e |
| Pick or add a release; case does not matter; the list reloads when it opens | done | clicked, e2e |
| A new run copies the team's library (116 functions, 33 features) | done | clicked, e2e |
| Module cards that open and close with passed / total in the state colour | done | clicked |
| Passed / Failed / Blocked, second click back to Not tested, rollback on a failed save | done | clicked |
| Comment on blur or Enter, URLs and Jira keys become links | done | clicked, e2e, unit |
| History: last change and the full history | done | clicked, e2e |
| Add module, feature, function (Enter / Esc), "Also add to future runs" | done | clicked |
| Rename (also in the library), Remove from library | done | clicked |
| Sticky bar with progress, quick filters, search, started and completed by, Run history | done | clicked |
| Complete warns about Not tested items, read only after, Reopen | done | clicked, e2e |
| Sprint runs start empty; items with type, title and a checked Jira link; edit and remove | done | clicked, e2e |

## Members

| Feature | Status | Checked |
|---|---|---|
| Add a user with a temporary password | done | clicked, e2e `members.spec.ts` |
| Change role (applies at once) | done | clicked |
| Set a new password | done | clicked |
| Remove | done | clicked, e2e |

## Demo data, CI and docs

| Feature | Status | Checked |
|---|---|---|
| Seed: users, mock Teams channels, 3 schedules, 2 suites, 30 days of history (`source = seed`), Test Plans and Regression | done | clicked |
| `npm run seed -- --reset` | done | used before every check |
| GitHub Actions: lint, typecheck, Vitest, build, Playwright against Postgres | done | green on GitHub |
| Azure Pipelines YAML with the same steps | done | written, not run (no Azure DevOps project) |
| README with screenshots, Mermaid diagram, how to run, users, variables, features | done | |
| `docs/DESIGN.md` | done | |
