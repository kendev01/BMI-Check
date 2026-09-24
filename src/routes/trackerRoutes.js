const express = require('express');
const { requireAuth, profileFromUser, saveGoalDates } = require('../auth');
const calendarGrid = require('../calendarGrid');
const goals = require('../goals');
const { getFullResults, CATEGORY_LABELS, CATEGORY_BADGE_CLASSES } = require('../calculations');
const entries = require('../entries');
const { buildFigure } = require('../figure2d');

const router = express.Router();

function renderDashboard(req, res, { status = 200, errors = {}, values = {}, editingId = null } = {}) {
  const date = entries.isValidDate(req.query.date) ? req.query.date : entries.todayISO();
  const profile = profileFromUser(req.user);
  const results = profile ? getFullResults(profile) : null;

  const total = entries.totalForDate(req.user.id, date);
  const target = results ? results.recommendedCalories : null;

  res.status(status).render('dashboard', {
    date,
    today: entries.todayISO(),
    items: entries.listForDate(req.user.id, date),
    total,
    target,
    remaining: target === null ? null : target - total,
    percentOfTarget: target ? Math.min(Math.round((total / target) * 100), 100) : null,
    overTarget: target !== null && total > target,
    results,
    profile,
    figure: results ? buildFigure(results.bmiActual, profile.sex, 'current', profile.age) : null,
    history: entries.recentDays(req.user.id),
    goal: buildGoalContext(req.user, results),
    CATEGORY_LABELS,
    CATEGORY_BADGE_CLASSES,
    errors,
    values,
    // Which row (if any) renders as an inline edit form.
    editingId: editingId !== null ? editingId : Number(req.query.edit) || null,
  });
}

function buildGoalContext(user, results) {
  if (!user.goal_start_date || !user.goal_target_date) return null;

  return {
    startDate: user.goal_start_date,
    targetDate: user.goal_target_date,
    progress: goals.goalProgress({
      startDate: user.goal_start_date,
      targetDate: user.goal_target_date,
      today: entries.todayISO(),
    }),
    assessment: results
      ? goals.assessTargetDate({
          actualWeightKg: user.actual_weight_kg,
          desiredWeightKg: user.desired_weight_kg,
          startDate: user.goal_start_date,
          targetDate: user.goal_target_date,
        })
      : null,
  };
}

router.get('/calendar', requireAuth, (req, res) => {
  const month = calendarGrid.isValidMonth(req.query.month)
    ? req.query.month
    : calendarGrid.currentMonth();

  const profile = profileFromUser(req.user);
  const results = profile ? getFullResults(profile) : null;
  const target = results ? results.recommendedCalories : null;

  res.render('calendar', {
    calendar: calendarGrid.buildMonth(month, entries.monthTotals(req.user.id, month), {
      target,
      today: entries.todayISO(),
    }),
    target,
    goal: buildGoalContext(req.user, results),
  });
});

router.post('/goal', requireAuth, (req, res) => {
  const startDate = entries.isValidDate(req.body.startDate) ? req.body.startDate : entries.todayISO();
  const targetDate = entries.isValidDate(req.body.targetDate) ? req.body.targetDate : null;

  if (targetDate) saveGoalDates(req.user.id, startDate, targetDate);
  res.redirect(req.body.returnTo === 'results' ? '/dashboard' : '/dashboard');
});

router.get('/dashboard', requireAuth, (req, res) => {
  renderDashboard(req, res);
});

router.post('/entries', requireAuth, (req, res) => {
  const { isValid, errors, values } = entries.validateEntry({
    ...req.body,
    entryDate: entries.isValidDate(req.body.entryDate) ? req.body.entryDate : entries.todayISO(),
  });

  if (!isValid) {
    req.query.date = values.entryDate || entries.todayISO();
    return renderDashboard(req, res, { status: 400, errors, values });
  }

  entries.addEntry(req.user.id, values);
  res.redirect(`/dashboard?date=${values.entryDate}`);
});

router.post('/entries/:id', requireAuth, (req, res) => {
  const entryId = Number(req.params.id);
  const existing = entries.findEntry(req.user.id, entryId);
  if (!existing) return res.redirect('/dashboard');

  const { isValid, errors, values } = entries.validateEntry({
    ...req.body,
    entryDate: existing.entry_date,
  });

  if (!isValid) {
    req.query.date = existing.entry_date;
    return renderDashboard(req, res, { status: 400, errors, values, editingId: entryId });
  }

  entries.updateEntry(req.user.id, entryId, values);
  res.redirect(`/dashboard?date=${existing.entry_date}`);
});

router.post('/entries/:id/delete', requireAuth, (req, res) => {
  entries.deleteEntry(req.user.id, Number(req.params.id));
  const date = entries.isValidDate(req.body.entryDate) ? req.body.entryDate : entries.todayISO();
  res.redirect(`/dashboard?date=${date}`);
});

module.exports = router;
