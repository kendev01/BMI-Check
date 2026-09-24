# BMI Check

Enter your height, actual weight, desired weight, age, sex, and activity level to get:

- Your current and goal BMI (with category) on a colour-coded BMI scale
- Side-by-side animated body-type illustrations comparing your current and goal build, matched to your age and sex
- A recommended daily calorie intake to move toward your goal weight

Create an account to:

- Log what you eat each day, editing or removing entries per day
- See a **calendar** of every day, colour-coded against your target
- Set **start and target dates** for your goal, with a realistic projected timeline
- Reset your password by email if you forget it

## Setup

```bash
npm install
npm run dev   # starts the server with nodemon at http://localhost:5050
```

Or for a plain start without auto-reload:

```bash
npm start
```

The SQLite database is created automatically at `bmicheck.db` on first run.

## Tests

```bash
npm test
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5050` | HTTP port |
| `DB_PATH` | `./bmicheck.db` | SQLite database file |
| `SESSION_SECRET` | dev fallback | Signs the session cookie. **Set this to a random value before deploying anywhere real.** |
| `APP_URL` | request host | Base URL used in password-reset links |
| `SMTP_HOST` | _(unset)_ | SMTP server for outgoing mail. Without it, see "Email" below |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | _(unset)_ | SMTP credentials |
| `MAIL_FROM` | `BMI Check <no-reply@bmicheck.local>` | From address |

## Email

Password resets need to send mail. The app tries three things in order:

1. **Your SMTP server**, if `SMTP_HOST` is set. For Gmail, use an
   [App Password](https://support.google.com/accounts/answer/185833) rather than your account password:
   `SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true SMTP_USER=you@gmail.com SMTP_PASS=your-app-password`
2. **An Ethereal test inbox** (needs internet) — the reset link is logged as a preview URL.
3. **`./outbox`** — the message is written to disk and the reset link is shown on screen, so the
   flow still works with no mail server at all.

Tiers 2 and 3 are for development only; set `SMTP_HOST` for anything real.

## Notes

Calorie recommendations use the Mifflin-St Jeor BMR formula and are general estimates, not medical advice.

Goal timelines follow the CDC's guidance that gradual weight loss of about 1–2 lb (0.45–0.9 kg) per week is
most likely to be sustained, combined with the standard ~7,700 kcal-per-kg energy figure. That static figure
overestimates long-run loss because metabolism adapts as weight comes off, so the projected date is a plan
rather than a prediction — re-run the calculator as your weight changes and the target re-derives itself.
"# BMI-Check" 
