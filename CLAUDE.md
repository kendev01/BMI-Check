# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev     # nodemon, http://localhost:5050
npm start       # plain node
npm test        # Node's built-in runner (node --test)

node --test test/calculations.test.js                      # one file
node --test --test-name-pattern="clamps to the safe minimum"  # one test
```

Default port is 5050 (`PORT` overrides). The app reads eleven environment variables in total; README.md has the table. Two matter most when working locally:

- `DB_PATH` — SQLite file, default `./bmicheck.db`. Delete it to start clean; `./outbox` and the `.db-wal`/`.db-shm` siblings are generated too, and all are gitignored.
- `SMTP_HOST` — **unset by default, which changes behaviour rather than failing.** Password-reset mail then falls back to an Ethereal test inbox, or, with no network, to `.eml` files in `./outbox` with the reset link echoed on screen. Do not read that as the feature being broken.

## Architecture

Express + EJS, server-rendered throughout. No JSON API. The BMI calculator is public; accounts and the calorie tracker sit on top of it.

Data lives in SQLite (`bmicheck.db`, override with `DB_PATH`) via `better-sqlite3`, whose API is **synchronous** — no `await` on queries. Schema is created on import of `src/db.js`; columns added after the first release go through the `addColumn` helper there, since SQLite has no `ADD COLUMN IF NOT EXISTS`.

**Pin better-sqlite3 to a version matching the runtime Node.** This machine has several Node installs; installing a build for the wrong ABI does not fail at install time, it segfaults on first query. Runtime is Node 18, so the dependency is pinned to `^11`. If you upgrade Node, reinstall it.

**There is no build step.** Tailwind and the web font come from CDN links in `views/partials/head.ejs`. There is no bundler, PostCSS, or `tailwind.config.js`, so `@apply` and custom theme values will not work — use arbitrary-value classes (`bg-[radial-gradient(...)]`) instead. Files in `public/` are served raw.

The UI is **dark-only**: `bg-slate-950` surfaces, `ring-white/10` borders, emerald as the single accent. `CATEGORY_BADGE_CLASSES` and `CATEGORY_BAR_CLASSES` in `src/calculations.js` are dark-theme classes; changing the theme means changing them too.

Request flow: `server.js` → `src/routes/bmiRoutes.js` → validate → compute → render.

- `src/validation.js` — coerces and range-checks input; returns `{ isValid, errors, values }`. Invalid input re-renders the form with a 400 and the user's original `req.body` so nothing is lost.
- `src/calculations.js` — pure functions: BMI, WHO category, Mifflin-St Jeor BMR, TDEE, calorie recommendation. Also owns the category→Tailwind-class maps, so badge/bar colors stay consistent across views.

  Note the activity-level keys are offset from their display labels: key `active` shows as "Very active" (×1.725) and key `very_active` shows as "Extra active" (×1.9). Read `ACTIVITY_MULTIPLIERS` rather than inferring a tier from its key name.
- `src/figure2d.js` — maps BMI + sex to the illustrated figure's geometry.
- `src/db.js` — connection and schema (created on import, idempotent).
- `src/auth.js` — scrypt hashing, user queries, `attachUser` / `requireAuth`.
- `src/entries.js` — calorie-log queries and entry validation.
- `src/goals.js` — goal timeline maths; read the header comment before touching it.
- `src/calendarGrid.js` — month grid construction (pure; no DB).
- `src/passwordReset.js` / `src/mailer.js` — reset tokens and outgoing mail.

### Auth and the tracker

Sessions are a signed cookie (`cookie-session`) holding only `userId`; `attachUser` runs globally and sets `req.user` plus `res.locals.currentUser`, which `views/partials/nav.ejs` reads unconditionally. Anything rendering a view must run behind that middleware.

`trackerRoutes` is mounted at `/`, so **`requireAuth` is attached per-route, not via `router.use`** — a router-level guard there would gate the public calculator too.

Entry editing is server-rendered with no JavaScript: `?edit=<id>` on the dashboard renders that one row as an inline form, and `POST /entries/:id` saves it. Route order matters only in that `/entries/:id/delete` has an extra segment, so it cannot collide with `/entries/:id`.

The calendar is likewise pure server rendering — `buildMonth()` returns a Monday-first grid already padded to whole weeks, with each cell's status resolved, so the view does no date maths.

`public/js/passwordToggle.js` injects the show/hide button into every `input[type="password"]` at runtime rather than having it in the templates, so it never appears when scripting is off (where it could not work).

Two invariants worth preserving:

- Every entry query filters on `user_id` — `findEntry`, `updateEntry` and `deleteEntry` alike — so a guessed row id cannot reach another account. The update and delete helpers return the changed-row count for exactly this reason.
- Passwords are scrypt with a per-user random salt, compared via `timingSafeEqual`. Login failures return one generic message so the form cannot enumerate registered emails.

CSRF protection is the session cookie's `sameSite: 'lax'`, not tokens — which holds only while state-changing requests stay POST. A state-changing GET would silently bypass it.

### Password reset

Only the SHA-256 **hash** of a reset token is stored, so a database leak cannot be turned into account takeover; the raw token exists only in the emailed link. Tokens last an hour, are single-use, and a successful reset invalidates every other outstanding token for that user.

`POST /forgot` must render the **same response** whether or not the address is registered — including when mail fails. An earlier version let a send error propagate to a 500 while unknown addresses got a 200, which turned the form into an account-enumeration oracle. Mail errors are caught and logged, never surfaced.

`src/mailer.js` falls back SMTP → Ethereal → `./outbox` file. The file tier exists so the flow still completes with no network at all; it returns the reset URL for the page to display, which is acceptable only because it means no mail server exists to deliver it.

### Goal timelines

`src/goals.js` carries a header comment with the sourcing and, more importantly, the **caveat**: the ~7,700 kcal/kg static rule overestimates real long-term loss because metabolic adaptation lowers energy expenditure as weight drops. Projections are therefore clamped to the CDC's safe 0.45–0.9 kg/week range (0.25–0.5 for gain) and presented as a plan, not a prediction. If you extend this, do not present the linear projection as fact.

Users carry their last calculator inputs as nullable profile columns. The tracker recomputes the target from those via `getFullResults()` rather than storing a number, so it never goes stale; a user who has not run the calculator has no target and the dashboard prompts instead.

### EJS locals gotcha

**Functions passed as EJS locals are not callable inside templates.** Precompute values in the route and pass plain data. `buildBmiScale()` in `bmiRoutes.js` exists for exactly this reason — it resolves marker positions, segment widths, and tick positions to percentages server-side.

Keep logic out of the views generally: templates should only read prepared data.

### The illustrated figures

Rendered as **server-generated SVG**, not WebGL — an earlier Three.js version was replaced. `src/figure2d.js` computes the geometry and `views/partials/figure.ejs` draws it; the idle animation is pure CSS in `public/css/styles.css`.

Proportions are a **continuous** function of BMI **and age**, not four fixed category shapes. In `bodyWidths()` each girth scales as `base * (bmi/22)^exponent` with a different exponent per part, plus a sex modifier. The load-bearing tuning is the **waist/chest relationship**: the waist's larger base and exponent make it overtake the chest at roughly BMI 30, which is what makes a heavy build read as belly-shaped instead of as a uniformly scaled lean one. `test/figure2d.test.js` pins that crossover — if you retune an exponent, run the tests and then look at a render.

Two drawing conventions that matter:

- Limbs are **stroked polylines with round caps**, not closed outlines, so there is no left/right path to keep symmetric. Each limb is drawn twice: a wider `skinLine` stroke underneath, then `skin` on top. Without that under-stroke the arms vanish into the torso, since both are the same fill.
- Arm `clearance` is derived from the widest of shoulder/waist/hip, so arms stay outside the body at every BMI.

`ageTraits(age, sex)` supplies the ageing cues: hair colour interpolated toward grey from ~35, a receding hairline for men from ~30, face lines from ~38, and a slump that lowers the head. `bodyWidths` also takes age — at equal BMI an older frame is narrower at the shoulders and thicker at the waist, matching how muscle mass and fat distribution actually shift. Every `buildFigure` call site must pass the real age, or figures silently default to 30.

Anything the SVG needs positioned (such as the hand circle) is exposed as data from `figure2d.js` — do not parse coordinates back out of the path strings.

CSS `transform-origin` values for the animation are in the SVG's **viewBox units** (e.g. `100px 220px`), not percentages of the rendered box. They must track `LAYOUT` if the skeleton moves.

### Validation is intentionally duplicated

`public/js/formValidation.js` repeats the ranges and enums from `src/validation.js`. There is no shared bundler, so this is accepted; the server is authoritative. Both paths write into the same `data-error-for="<field>"` slots in `views/index.ejs` — keep that contract when adding a field, and keep the ranges in sync.

## Verifying UI changes

The results view is **POST-only** and the dashboard needs a session, so neither can be screenshotted by URL directly. Run a throwaway server in the scratchpad that mounts the real routers plus `attachUser`, with two helpers: a GET alias for the results view (set `req.body = req.query`, `req.method = 'POST'`, `req.url = '/calculate'`, then call the router) and an `/as/:id` route that sets `req.session.userId`. Then screenshot with headless Chrome:

```bash
chrome --headless=new --disable-gpu --hide-scrollbars   --window-size=900,1000 --virtual-time-budget=5000   --screenshot=out.png "http://127.0.0.1:PORT/preview?heightCm=170&..."
```

The harness must include `attachUser`, or every view fails on `currentUser` in the nav partial. Note two environment quirks: `localhost` does not resolve in this shell (use `127.0.0.1` with `curl --noproxy '*'`), and headless Chrome clamps the window to ~500px wide, so narrower phone widths cannot be verified this way.

Tests cover `src/calculations.js`, `src/figure2d.js`, `src/goals.js`, `src/calendarGrid.js`, password hashing and reset tokens, and the calorie-log queries. The views themselves are not covered, so check rendering changes visually.

Database tests set `DB_PATH` to a temp file **before** requiring anything that pulls in `src/db.js` — that module opens the database at import time.
