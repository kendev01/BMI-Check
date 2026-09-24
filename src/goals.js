// Basis for the timeline maths, and its limits.
//
// Safe rate: the CDC recommends losing weight at a gradual, steady pace of
// about 1 to 2 lb (0.45-0.9 kg) per week, noting that people who lose weight
// this way are more likely to keep it off.
// https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
//
// Energy density: the classic figure is ~3500 kcal per lb (~7700 kcal per kg),
// derived from the average energy content of lost tissue.
//
// IMPORTANT CAVEAT: that static rule overestimates real long-term loss, because
// it ignores metabolic adaptation — resting metabolic rate and the energy cost
// of activity all fall as weight comes off, so an unchanged deficit yields
// progressively less loss. See Hall, "Why is the 3500 kcal per pound weight
// loss rule wrong?" (https://pmc.ncbi.nlm.nih.gov/articles/PMC3859816).
//
// So we use the deficit only for a short-horizon estimate, clamp every
// projection to the safe range, and tell the user to re-run the calculator as
// their weight changes — which re-derives the target from their new weight and
// absorbs the adaptation instead of pretending a single straight line holds.

const KCAL_PER_KG = 7700;

const SAFE_RATES_KG_PER_WEEK = {
  loss: { min: 0.45, max: 0.9 },
  // Lean-gain guidance is slower than loss; going faster mostly adds fat.
  gain: { min: 0.25, max: 0.5 },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toISODate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseISODate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(isoDate, days) {
  const base = parseISODate(isoDate);
  if (!base) return null;
  return toISODate(new Date(base.getTime() + days * MS_PER_DAY));
}

function daysBetween(fromISO, toISO) {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Projects how long the goal should take from the calorie plan, clamped to the
 * safe range. `startDate` defaults to today.
 */
function projectGoal({ actualWeightKg, desiredWeightKg, tdee, recommendedCalories, startDate }) {
  const deltaKg = Math.abs(desiredWeightKg - actualWeightKg);
  const start = startDate || toISODate(new Date());

  if (deltaKg <= 0.5) {
    return { goalType: 'maintain', deltaKg, startDate: start, projectedDate: null, weeks: null };
  }

  const goalType = desiredWeightKg < actualWeightKg ? 'loss' : 'gain';
  const safe = SAFE_RATES_KG_PER_WEEK[goalType];

  const dailyGap = Math.abs(tdee - recommendedCalories);
  const impliedRate = (dailyGap * 7) / KCAL_PER_KG;

  // A maintenance-level plan implies no movement; fall back to the safe minimum
  // so the estimate stays finite rather than dividing by ~zero.
  const rate = clamp(impliedRate || safe.min, safe.min, safe.max);
  const clamped = impliedRate > 0 && (impliedRate < safe.min || impliedRate > safe.max);

  const weeks = deltaKg / rate;
  const days = Math.ceil(weeks * 7);

  return {
    goalType,
    deltaKg: Math.round(deltaKg * 10) / 10,
    startDate: start,
    projectedDate: addDays(start, days),
    weeks: Math.round(weeks * 10) / 10,
    days,
    rateKgPerWeek: Math.round(rate * 100) / 100,
    safeMin: safe.min,
    safeMax: safe.max,
    clamped,
  };
}

/**
 * Checks a user-chosen target date against the safe range, so the UI can warn
 * before someone commits to a crash timeline.
 */
function assessTargetDate({ actualWeightKg, desiredWeightKg, startDate, targetDate }) {
  const deltaKg = Math.abs(desiredWeightKg - actualWeightKg);
  const days = daysBetween(startDate, targetDate);

  if (days === null || days <= 0) return { valid: false, reason: 'Target date must be after the start date.' };
  if (deltaKg <= 0.5) return { valid: true, verdict: 'maintain', requiredRate: 0 };

  const goalType = desiredWeightKg < actualWeightKg ? 'loss' : 'gain';
  const safe = SAFE_RATES_KG_PER_WEEK[goalType];
  const requiredRate = deltaKg / (days / 7);

  let verdict = 'safe';
  if (requiredRate > safe.max) verdict = 'too-fast';
  else if (requiredRate < safe.min) verdict = 'relaxed';

  return {
    valid: true,
    verdict,
    goalType,
    days,
    requiredRate: Math.round(requiredRate * 100) / 100,
    safeMin: safe.min,
    safeMax: safe.max,
  };
}

/** Progress along the goal window, for the dashboard. */
function goalProgress({ startDate, targetDate, today }) {
  const now = today || toISODate(new Date());
  const total = daysBetween(startDate, targetDate);
  if (total === null || total <= 0) return null;

  const elapsed = daysBetween(startDate, now);
  const remaining = daysBetween(now, targetDate);

  return {
    totalDays: total,
    elapsedDays: Math.max(elapsed, 0),
    remainingDays: remaining,
    percent: clamp(Math.round((elapsed / total) * 100), 0, 100),
    overdue: remaining < 0,
  };
}

module.exports = {
  KCAL_PER_KG,
  SAFE_RATES_KG_PER_WEEK,
  toISODate,
  addDays,
  daysBetween,
  projectGoal,
  assessTargetDate,
  goalProgress,
};
